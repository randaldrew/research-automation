#!/usr/bin/env python3
"""
Link extraction module for Research Automation
Ported from existing codebase - ready to use as-is

This module handles extracting, cleaning, and processing links from email content.
It provides functionality to identify meaningful links while filtering out ads and
tracking URLs.
"""

import re
from urllib.parse import urlparse, parse_qs, unquote, urlunparse


class LinkExtractor:
    """
    A class for extracting and processing links from text content.

    This class provides methods to extract links from email newsletters and other
    text content, clean URLs of tracking parameters, filter out ad links, and
    extract meaningful titles.
    """

    def __init__(self):
        """Initialize the LinkExtractor"""
        # Lists of patterns for filtering
        self.ad_domains = [
            "doubleclick.net", "googleadservices.com", "google-analytics.com",
            "facebook.com/tr", "linkedin.com/pixel", "ads.twitter.com",
            "amazon-adsystem.com", "adservice.google", "fastclick.net",
            "clicktrack", "tracking", "track.", "pixel.", "beacon.",
            "analytics.", "telemetry.", "mailchimp.com/track",
            "list-manage.com/track", "ads."
        ]

        self.skip_patterns = [
            r'\.png(\?|$)', r'\.jpe?g(\?|$)', r'\.gif(\?|$)', r'\.svg(\?|$)',  # Image files
            r'/pixel', r'/tracking', r'/track/', r'/click/',  # Tracking endpoints
            r'unsubscribe', r'manage-preferences', r'email-preferences'  # Email management
        ]

        self.tracking_params = [
            'utm_', 'ref_', 'mc_', 'fb_', 'yclid=', 'gclid=',
            '_hsenc=', '_hsmi=', 'cmpid=', 'cid=', 'sid=', 'mc_cid='
        ]

    def extract_links(self, content):
        """
        Extract valid URLs from the content while filtering out likely ad links.

        Args:
            content (str): The email content to extract links from

        Returns:
            list: A list of dictionaries with title and url keys
        """
        # Clean content first to improve extraction
        content = self._clean_content(content)

        # Find all URLs in the content with context
        # This regex looks for URLs with http/https
        url_matches = re.finditer(
            r'(?:(?<=\s)|(?<=^)|(?<=\())((https?://[^\s\)\]\}>"\']+))',
            content
        )

        # Store extracted links with surrounding context
        extracted_links = []
        for match in url_matches:
            full_url = match.group(1)

            # Clean the URL of tracking parameters
            clean_url = self._clean_url_tracking_params(full_url)

            # Skip common ad domains and tracking links
            if self._should_skip_url(clean_url):
                continue

            # Try to find the link text/title
            # Look for text near the URL that might be a title
            start_pos = max(0, match.start() - 200)  # Increased context window
            end_pos = min(len(content), match.end() + 50)
            context = content[start_pos:end_pos]

            # Extract title - look for text inside quotes, brackets, or just before the URL
            title = self._extract_title_from_context(context, full_url)

            # Check if we have a reasonable title
            if title and len(title) > 3 and len(title) < 200:
                extracted_links.append({
                    "url": clean_url,
                    "title": title
                })
            else:
                # Try to get title from URL itself if we couldn't find a good context title
                url_title = self._extract_title_from_url(clean_url)
                extracted_links.append({
                    "url": clean_url,
                    "title": url_title
                })

        # Remove duplicates while preserving order
        unique_links = []
        seen_urls = set()
        for link in extracted_links:
            normalized_url = self._normalize_url(link["url"])
            if normalized_url not in seen_urls:
                unique_links.append(link)
                seen_urls.add(normalized_url)

        return unique_links

    def _clean_content(self, content):
        """Clean the content to improve link extraction"""
        # Remove common email signatures and footers
        content = re.sub(r'(?i)unsubscribe.*?$', '', content, flags=re.DOTALL)
        # Remove excess whitespace
        content = re.sub(r'\s+', ' ', content)
        # Replace encoded HTML entities
        content = content.replace('&amp;', '&')
        content = content.replace('&lt;', '<')
        content = content.replace('&gt;', '>')
        content = content.replace('&quot;', '"')
        content = content.replace('&apos;', "'")
        return content

    def _clean_url_tracking_params(self, url):
        """Clean URL by removing tracking parameters"""
        try:
            # Parse the URL
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)

            # Filter out tracking parameters
            filtered_params = {}
            for param, value in query_params.items():
                if not any(param.startswith(tp) for tp in self.tracking_params):
                    filtered_params[param] = value

            # Rebuild the query string
            from urllib.parse import urlencode
            query_string = urlencode(filtered_params, doseq=True)

            # Rebuild the URL
            cleaned_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                query_string,
                parsed.fragment
            ))

            return cleaned_url
        except:
            # If anything goes wrong, return the original URL
            return url

    def _should_skip_url(self, url):
        """Check if a URL should be skipped (ads, tracking links, etc.)"""
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()
        path = parsed_url.path.lower()
        query = parsed_url.query.lower()

        # Check for ad domains
        if any(ad_domain in domain for ad_domain in self.ad_domains):
            return True

        # Check for tracking/ad paths
        if any(re.search(pattern, path + "?" + query) for pattern in self.skip_patterns):
            return True

        # Skip URLs that are too short (likely redirects)
        if len(url) < 20 and '/r/' in url:
            return True

        # Skip URLs that seem like email management
        if any(term in (path + query).lower() for term in ['unsubscribe', 'opt-out', 'opt_out', 'preference']):
            return True

        # Skip very long URLs (likely with lots of tracking)
        if len(url) > 500:
            return True

        return False

    def _extract_title_from_context(self, context, url):
        """Extract a likely title for the link from surrounding context"""
        # Try to find title in different formats:

        # 1. Look for markdown-style links: [Title](url)
        bracket_match = re.search(r'\[(.*?)\]\s*\(' + re.escape(url) + r'\)', context)
        if bracket_match:
            return bracket_match.group(1).strip()

        # 2. Look for HTML-style links: <a href="url">Title</a>
        html_match = re.search(r'<a[^>]*href\s*=\s*["\']' + re.escape(url) + r'["\'][^>]*>(.*?)</a>', context)
        if html_match:
            return re.sub(r'<[^>]*>', '', html_match.group(1)).strip()

        # 3. Look for text in quotes near the URL
        quote_match = re.search(r'["\'](.*?)["\']\s*(?::|link|at|->|→|:|,)?\s*' + re.escape(url), context)
        if quote_match:
            return quote_match.group(1).strip()

        # 4. Look for read more/click here patterns
        read_more_match = re.search(
            r'(Read more|Read the article|Read the full article|Read full article|Click here|More info|Learn more|Continue reading)(?:[^.]|$)',
            context,
            re.IGNORECASE
        )
        if read_more_match:
            # Look for a title before this phrase
            before_read_more = context[:read_more_match.start()]
            # Take the last sentence or phrase that's not too long
            sentences = re.split(r'[.!?]', before_read_more)
            if sentences and len(sentences[-1].strip()) > 10:
                return sentences[-1].strip()

        # 5. Look for text ending with a colon before the URL
        colon_match = re.search(r'([^.!?:]{5,150}):\s*' + re.escape(url), context)
        if colon_match:
            return colon_match.group(1).strip()

        # 6. Look for nearby headers or emphasized text
        header_match = re.search(r'(?:^|\n)#+\s+(.*?)(?:\n|$)', context)
        if header_match:
            return header_match.group(1).strip()

        # 7. Look for text in the line before the URL
        lines = context.split('\n')
        for i, line in enumerate(lines):
            if url in line and i > 0:
                prev_line = lines[i - 1].strip()
                if 5 < len(prev_line) < 200 and not prev_line.startswith('http'):
                    return prev_line

        return None

    def _extract_title_from_url(self, url):
        """Extract a title from the URL itself when context doesn't provide one"""
        parsed = urlparse(url)
        domain = parsed.netloc
        path = parsed.path

        # Remove www. prefix if present
        if domain.startswith('www.'):
            domain = domain[4:]

        # If it's a home page or very short path, just use the domain
        if not path or path == '/' or len(path) < 5:
            return f"Article from {domain}"

        # Try to extract a title from the path
        # First, decode any URL encoding
        path = unquote(path)

        # Remove file extensions and trailing slashes
        path = re.sub(r'\.\w{2,4}$', '', path)  # Remove file extensions
        path = path.rstrip('/')

        # Split path into segments
        segments = [s for s in path.split('/') if s]

        # Use the last segment that's not a date or ID
        for segment in reversed(segments):
            # Skip likely date patterns
            if re.match(r'^(\d{4}|\d{2})/\d{1,2}/\d{1,2}$', segment):
                continue

            # Skip segments that are just numbers
            if re.match(r'^\d+$', segment):
                continue

            # Replace dashes and underscores with spaces
            title_candidate = segment.replace('-', ' ').replace('_', ' ')

            # Capitalize words properly
            title_candidate = ' '.join(word.capitalize() for word in title_candidate.split())

            # If title seems reasonable, use it
            if len(title_candidate) > 3 and len(title_candidate) < 100:
                return title_candidate

        # If no good segment found, use domain name
        return f"Article from {domain}"

    def _normalize_url(self, url):
        """Normalize URL for deduplication"""
        try:
            parsed = urlparse(url)

            # Lowercase the domain
            domain = parsed.netloc.lower()

            # Remove 'www.' if present
            if domain.startswith('www.'):
                domain = domain[4:]

            # Keep the path but remove trailing slash
            path = parsed.path.rstrip('/')

            # Remove tracking parameters
            query = parsed.query
            for param in self.tracking_params:
                query = re.sub(f'{param}[^&]*&?', '', query)

            # Remove any trailing ampersands
            query = query.rstrip('&')

            # Remove fragment (anchor)
            fragment = ''

            # Rebuild the URL
            normalized = urlunparse((
                parsed.scheme,
                domain,
                path,
                parsed.params,
                query,
                fragment
            ))

            return normalized
        except:
            # If anything goes wrong, return the original URL
            return url
#!/usr/bin/env python3
"""
Web Source Plugin for Research Automation
Implements web scraping functionality using BeautifulSoup and httpx
"""

import asyncio
import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup, Tag
import re

from ..base_plugin import BaseSourcePlugin, SourcePluginError
from ...core.logging import get_logger
from ...processing.content_cleaner import ContentCleaner

logger = get_logger(__name__)


class WebSourcePlugin(BaseSourcePlugin):
    """
    Web scraping source plugin.

    Supports various scraping patterns:
    - Article list pages with links to full articles
    - Direct content extraction from single pages
    - Multiple content types (blogs, news sites, etc.)
    """

    def __init__(self, source_id: str, config: Dict[str, Any]):
        """
        Initialize web scraping plugin.

        Args:
            source_id: Unique identifier for this web source
            config: Web scraping configuration dict
        """
        super().__init__(source_id, config)
        self.content_cleaner = ContentCleaner()

        # HTTP client configuration
        self.client_config = {
            'timeout': httpx.Timeout(30.0),
            'headers': {
                'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
                **config.get('headers', {})
            },
            'follow_redirects': True
        }

        # Rate limiting
        self.rate_limit_delay = config.get('rate_limit_delay', 2.0)

    async def fetch_content(self) -> List[Dict[str, Any]]:
        """
        Fetch web content based on configuration.

        Returns:
            List of article content items
        """
        try:
            self.logger.info(f"Fetching web content from {self.source_id}")

            scraping_mode = self.config.get('scraping_mode', 'article_list')

            if scraping_mode == 'article_list':
                return await self._fetch_from_article_list()
            elif scraping_mode == 'direct_content':
                return await self._fetch_direct_content()
            else:
                raise SourcePluginError(f"Unknown scraping mode: {scraping_mode}",
                                        self.source_id, 'web')

        except Exception as e:
            error_msg = f"Failed to fetch web content from {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            raise SourcePluginError(error_msg, self.source_id, 'web')

    async def _fetch_from_article_list(self) -> List[Dict[str, Any]]:
        """
        Fetch articles from a list page that contains links to individual articles.

        Returns:
            List of article content items
        """
        articles = []

        async with httpx.AsyncClient(**self.client_config) as client:
            # Fetch the article list page
            list_page_url = self.config.get('list_page', self.config.get('base_url'))

            if not list_page_url:
                raise SourcePluginError("No list_page or base_url specified",
                                        self.source_id, 'web')

            self.logger.debug(f"Fetching article list from {list_page_url}")
            response = await client.get(list_page_url)
            response.raise_for_status()

            # Parse the list page
            soup = BeautifulSoup(response.text, 'html.parser')

            # Find article links
            list_selector = self.config.get('list_selector', 'a')
            article_links = soup.select(list_selector)

            self.logger.debug(f"Found {len(article_links)} potential article links")

            # Limit number of articles to prevent overload
            max_articles = self.config.get('max_articles', 5)
            article_links = article_links[:max_articles]

            # Process each article link
            for i, link_element in enumerate(article_links):
                try:
                    # Rate limiting
                    if i > 0:
                        await asyncio.sleep(self.rate_limit_delay)

                    article_url = self._extract_article_url(link_element, list_page_url)
                    if not article_url:
                        continue

                    # Fetch individual article
                    article = await self._fetch_single_article(client, article_url)
                    if article:
                        articles.append(article)

                except Exception as e:
                    self.logger.warning(f"Error fetching article {i}: {e}")
                    continue

        self.logger.info(f"Successfully fetched {len(articles)} articles from {self.source_id}")
        return articles

    async def _fetch_direct_content(self) -> List[Dict[str, Any]]:
        """
        Fetch content directly from specified URLs.

        Returns:
            List of content items
        """
        articles = []
        urls = self.config.get('urls', [])

        if not urls:
            raise SourcePluginError("No URLs specified for direct content fetching",
                                    self.source_id, 'web')

        async with httpx.AsyncClient(**self.client_config) as client:
            for i, url in enumerate(urls):
                try:
                    # Rate limiting
                    if i > 0:
                        await asyncio.sleep(self.rate_limit_delay)

                    article = await self._fetch_single_article(client, url)
                    if article:
                        articles.append(article)

                except Exception as e:
                    self.logger.warning(f"Error fetching direct content from {url}: {e}")
                    continue

        return articles

    async def _fetch_single_article(self, client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
        """
        Fetch and parse a single article.

        Args:
            client: HTTP client instance
            url: Article URL

        Returns:
            Article content item or None if failed
        """
        try:
            self.logger.debug(f"Fetching article: {url}")

            response = await client.get(url)
            response.raise_for_status()

            # Parse article content
            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract article data
            title = self._extract_title(soup, url)
            content = self._extract_content(soup)
            author = self._extract_author(soup)
            date = self._extract_date(soup)

            # Apply content filtering
            if not self._should_include_article(title, content):
                return None

            # Clean content
            cleaned_content = self.content_cleaner.clean_text(content)

            article = {
                'title': title,
                'content': cleaned_content,
                'url': url,
                'date': date or datetime.datetime.now().isoformat(),
                'source': self.config.get('name', self.source_id),
                'source_type': 'web',
                'metadata': {
                    'plugin_source_id': self.source_id,
                    'author': author,
                    'scraped_at': datetime.datetime.now().isoformat(),
                    'content_length': len(cleaned_content),
                    'scraping_mode': self.config.get('scraping_mode', 'article_list')
                }
            }

            return article

        except Exception as e:
            self.logger.warning(f"Error processing article {url}: {e}")
            return None

    def _extract_article_url(self, link_element: Tag, base_url: str) -> Optional[str]:
        """Extract article URL from a link element"""
        try:
            href = link_element.get('href')
            if not href:
                return None

            # Convert relative URLs to absolute
            article_url = urljoin(base_url, href)

            # Basic URL validation
            parsed = urlparse(article_url)
            if not parsed.scheme or not parsed.netloc:
                return None

            return article_url

        except Exception:
            return None

    def _extract_title(self, soup: BeautifulSoup, url: str) -> str:
        """Extract article title using configured selectors"""
        title_selectors = self.config.get('title_selector', ['h1', 'title', '.article-title'])

        if isinstance(title_selectors, str):
            title_selectors = [title_selectors]

        for selector in title_selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    title = element.get_text().strip()
                    if title and len(title) > 5:  # Reasonable title length
                        return title
            except Exception:
                continue

        # Fallback to URL-based title
        return f"Article from {urlparse(url).netloc}"

    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract article content using configured selectors"""
        content_selectors = self.config.get('content_selector',
                                            ['.article-content', '.post-content', 'article', '.content'])

        if isinstance(content_selectors, str):
            content_selectors = [content_selectors]

        # Remove unwanted elements
        exclude_selectors = self.config.get('exclude_selectors',
                                            ['.advertisement', '.ads', '.sidebar', '.comments'])

        for selector in exclude_selectors:
            for element in soup.select(selector):
                element.decompose()

        # Extract content
        for selector in content_selectors:
            try:
                elements = soup.select(selector)
                if elements:
                    content_parts = []
                    for element in elements:
                        text = element.get_text().strip()
                        if text:
                            content_parts.append(text)

                    if content_parts:
                        return '\n\n'.join(content_parts)
            except Exception:
                continue

        # Fallback: extract all paragraph text
        paragraphs = soup.find_all('p')
        if paragraphs:
            content_parts = [p.get_text().strip() for p in paragraphs if p.get_text().strip()]
            return '\n\n'.join(content_parts)

        return ""

    def _extract_author(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract article author using configured selectors"""
        author_selectors = self.config.get('author_selector',
                                           ['.author', '.byline', '[rel="author"]'])

        if isinstance(author_selectors, str):
            author_selectors = [author_selectors]

        for selector in author_selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    author = element.get_text().strip()
                    if author:
                        return author
            except Exception:
                continue

        return None

    def _extract_date(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract article publication date"""
        date_selectors = self.config.get('date_selector',
                                         ['time[datetime]', '.publish-date', '.date'])

        if isinstance(date_selectors, str):
            date_selectors = [date_selectors]

        for selector in date_selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    # Try datetime attribute first
                    datetime_attr = element.get('datetime')
                    if datetime_attr:
                        return datetime_attr

                    # Try text content
                    date_text = element.get_text().strip()
                    if date_text:
                        return date_text
            except Exception:
                continue

        return None

    def _should_include_article(self, title: str, content: str) -> bool:
        """Determine if an article should be included based on filtering criteria"""
        min_content_length = self.config.get('min_content_length', 100)
        if len(content) < min_content_length:
            return False

        # Category filtering
        categories = self.config.get('categories', [])
        if categories:
            combined_text = f"{title} {content}".lower()
            if not any(category.lower() in combined_text for category in categories):
                return False

        # Keyword filtering
        required_keywords = self.config.get('required_keywords', [])
        if required_keywords:
            combined_text = f"{title} {content}".lower()
            if not any(keyword.lower() in combined_text for keyword in required_keywords):
                return False

        return True

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test web scraping by attempting to fetch a sample page.

        Returns:
            Test result dictionary
        """
        try:
            self.logger.info(f"Testing web scraping connection for {self.source_id}")

            # Determine test URL
            test_url = (self.config.get('list_page') or
                        self.config.get('base_url') or
                        (self.config.get('urls', [None])[0]))

            if not test_url:
                return {
                    'success': False,
                    'error': 'No URL configured for testing',
                    'details': {'source_id': self.source_id}
                }

            async with httpx.AsyncClient(**self.client_config) as client:
                response = await client.get(test_url)
                response.raise_for_status()

                # Basic content validation
                soup = BeautifulSoup(response.text, 'html.parser')

                # Test selectors if configured
                test_results = {}

                if 'list_selector' in self.config:
                    links = soup.select(self.config['list_selector'])
                    test_results['list_selector'] = len(links)

                if 'title_selector' in self.config:
                    titles = soup.select(self.config['title_selector'])
                    test_results['title_selector'] = len(titles)

                if 'content_selector' in self.config:
                    content_elements = soup.select(self.config['content_selector'])
                    test_results['content_selector'] = len(content_elements)

                return {
                    'success': True,
                    'message': f'Web scraping connection successful for {self.source_id}',
                    'details': {
                        'test_url': test_url,
                        'response_size': len(response.text),
                        'status_code': response.status_code,
                        'selector_tests': test_results,
                        'source_id': self.source_id
                    }
                }

        except Exception as e:
            error_msg = f"Web scraping connection test failed for {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'details': {'source_id': self.source_id}
            }

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate web scraping configuration.

        Args:
            config: Configuration to validate

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        scraping_mode = config.get('scraping_mode', 'article_list')

        if scraping_mode == 'article_list':
            # Validate article list mode
            if not config.get('list_page') and not config.get('base_url'):
                errors.append("Must specify either 'list_page' or 'base_url' for article_list mode")

            if not config.get('list_selector'):
                errors.append("Must specify 'list_selector' for article_list mode")

        elif scraping_mode == 'direct_content':
            # Validate direct content mode
            if not config.get('urls'):
                errors.append("Must specify 'urls' list for direct_content mode")
            elif not isinstance(config['urls'], list):
                errors.append("'urls' must be a list")
            elif len(config['urls']) == 0:
                errors.append("'urls' list cannot be empty")
        else:
            errors.append(f"Unknown scraping_mode: {scraping_mode}")

        # Validate URL formats
        urls_to_check = []
        if config.get('list_page'):
            urls_to_check.append(config['list_page'])
        if config.get('base_url'):
            urls_to_check.append(config['base_url'])
        if config.get('urls'):
            urls_to_check.extend(config['urls'])

        for url in urls_to_check:
            if not isinstance(url, str):
                errors.append(f"URL must be a string: {url}")
            elif not url.startswith(('http://', 'https://')):
                errors.append(f"URL must start with http:// or https://: {url}")

        # Validate numeric parameters
        max_articles = config.get('max_articles', 5)
        if not isinstance(max_articles, int) or max_articles < 1:
            errors.append("max_articles must be a positive integer")
        elif max_articles > 20:
            warnings.append("max_articles > 20 may slow down processing significantly")

        rate_limit = config.get('rate_limit_delay', 2.0)
        if not isinstance(rate_limit, (int, float)) or rate_limit < 0:
            errors.append("rate_limit_delay must be a non-negative number")
        elif rate_limit < 1.0:
            warnings.append("rate_limit_delay < 1.0 may trigger anti-bot measures")

        # Validate selectors format
        selector_fields = ['list_selector', 'title_selector', 'content_selector', 'author_selector']
        for field in selector_fields:
            if field in config:
                selector = config[field]
                if not isinstance(selector, (str, list)):
                    errors.append(f"{field} must be a string or list of strings")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    def get_source_info(self) -> Dict[str, Any]:
        """Get detailed information about this web source"""
        base_info = super().get_source_info()

        # Add web-specific information
        base_info.update({
            'scraping_mode': self.config.get('scraping_mode', 'article_list'),
            'base_url': self.config.get('base_url', 'Not configured'),
            'list_page': self.config.get('list_page', 'Not configured'),
            'max_articles': self.config.get('max_articles', 5),
            'rate_limit_delay': self.config.get('rate_limit_delay', 2.0),
            'has_content_filtering': bool(self.config.get('categories') or
                                          self.config.get('required_keywords')),
            'min_content_length': self.config.get('min_content_length', 100)
        })

        return base_info

    def get_config_schema(self) -> Dict[str, Any]:
        """Get web scraping plugin configuration schema"""
        return {
            'type': 'object',
            'properties': {
                'base_url': {
                    'type': 'string',
                    'title': 'Website URL',
                    'description': 'Base URL of the website to scrape',
                    'format': 'uri'
                },
                'scraping_mode': {
                    'type': 'string',
                    'title': 'Scraping Mode',
                    'description': 'How to scrape the website',
                    'enum': ['article_list', 'direct_content'],
                    'default': 'article_list'
                },
                'list_selector': {
                    'type': 'string',
                    'title': 'Article Links Selector',
                    'description': 'CSS selector for article links',
                    'default': 'a'
                },
                'title_selector': {
                    'type': 'string',
                    'title': 'Title Selector',
                    'description': 'CSS selector for article titles',
                    'default': 'h1'
                },
                'content_selector': {
                    'type': 'string',
                    'title': 'Content Selector',
                    'description': 'CSS selector for article content',
                    'default': '.content'
                }
            },
            'required': ['base_url'],
            'dependencies': {
                'scraping_mode': {
                    'properties': {
                        'scraping_mode': {'enum': ['article_list']}
                    },
                        'required': ['list_selector']
                }
            },
        }

    def get_config_template(self) -> Dict[str, Any]:
        """Get configuration template for web scraping"""
        return {
            'scraping_mode': {
                'type': 'select',
                'required': False,
                'options': ['article_list', 'direct_content'],
                'default': 'article_list',
                'description': 'How to scrape content: from article lists or direct URLs'
            },
            'base_url': {
                'type': 'url',
                'required': False,
                'description': 'Base URL of the website',
                'example': 'https://example.com'
            },
            'list_page': {
                'type': 'url',
                'required': False,
                'description': 'URL of page containing article links',
                'example': 'https://example.com/articles'
            },
            'list_selector': {
                'type': 'string',
                'required': False,
                'description': 'CSS selector to find article links',
                'example': '.article-list a, article h2 a'
            },
            'title_selector': {
                'type': 'string',
                'required': False,
                'description': 'CSS selector to extract article title',
                'default': 'h1',
                'example': 'h1, .article-title, .post-title'
            },
            'content_selector': {
                'type': 'string',
                'required': False,
                'description': 'CSS selector to extract article content',
                'default': 'article, .content',
                'example': '.article-content, .post-content, article p'
            },
            'max_articles': {
                'type': 'integer',
                'required': False,
                'description': 'Maximum articles to fetch per run',
                'default': 5,
                'min': 1,
                'max': 20
            },
            'rate_limit_delay': {
                'type': 'number',
                'required': False,
                'description': 'Seconds to wait between requests',
                'default': 2.0,
                'min': 0.5
            },
            'min_content_length': {
                'type': 'integer',
                'required': False,
                'description': 'Minimum article length to include',
                'default': 100
            },
            'categories': {
                'type': 'array',
                'required': False,
                'description': 'Only include articles containing these topics',
                'example': ['AI', 'technology', 'startups']
            }
        }
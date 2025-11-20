#!/usr/bin/env python3
"""
Content cleaning utilities for Research Automation
Handles text preprocessing and cleaning operations
"""

import re
from typing import Optional  # Fixed: removed invalid 'str' import


class ContentCleaner:
    """
    Utility class for cleaning and preprocessing text content.

    Handles HTML removal, whitespace normalization, and other text cleanup tasks.
    """

    def __init__(self):
        # Patterns for cleaning
        self.html_tag_pattern = re.compile(r'<[^>]+>')
        self.excessive_whitespace_pattern = re.compile(r'\s+')
        self.email_signature_pattern = re.compile(r'(?i)(unsubscribe|manage preferences|email preferences).*$',
                                                  re.DOTALL)

        # HTML entities mapping
        self.html_entities = {
            '&nbsp;': ' ',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&apos;': "'",
            '&#39;': "'",
            '&mdash;': '—',
            '&ndash;': '–',
            '&hellip;': '...',
            '&rsquo;': "'",
            '&lsquo;': "'",
            '&rdquo;': '"',
            '&ldquo;': '"',
        }

    def clean_email_content(self, content: str) -> str:
        """
        Clean email content by removing unwanted elements and normalizing text.

        Args:
            content: Raw email content

        Returns:
            Cleaned and normalized content
        """
        if not content:
            return ""

        # Remove HTML tags first
        content = self.remove_html_tags(content)

        # Replace HTML entities
        content = self.decode_html_entities(content)

        # Remove email signatures and footers
        content = self.remove_email_signatures(content)

        # Normalize whitespace
        content = self.normalize_whitespace(content)

        # Remove excessive line breaks
        content = self.clean_line_breaks(content)

        return content.strip()

    def remove_html_tags(self, content: str) -> str:
        """Remove HTML tags from content."""
        return self.html_tag_pattern.sub(' ', content)

    def decode_html_entities(self, content: str) -> str:
        """Decode HTML entities to their text equivalents."""
        for entity, replacement in self.html_entities.items():
            content = content.replace(entity, replacement)

        # Handle numeric HTML entities (e.g., &#8217;)
        content = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))) if int(m.group(1)) < 1114112 else m.group(0),
                         content)

        return content

    def remove_email_signatures(self, content: str) -> str:
        """Remove common email signatures and unsubscribe footers."""
        # Remove unsubscribe and preference management sections
        content = self.email_signature_pattern.sub('', content)

        # Remove common signature patterns
        signature_patterns = [
            r'(?i)--+\s*$.*',  # -- signature delimiter
            r'(?i)sent from my \w+.*$',  # "Sent from my iPhone/Android"
            r'(?i)this email was sent.*$',  # Email service notifications
            r'(?i)you received this.*$',  # Subscription notifications
        ]

        for pattern in signature_patterns:
            content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)

        return content

    def normalize_whitespace(self, content: str) -> str:
        """Normalize whitespace by collapsing multiple spaces, tabs, etc."""
        return self.excessive_whitespace_pattern.sub(' ', content)

    def clean_line_breaks(self, content: str) -> str:
        """Clean up excessive line breaks while preserving paragraph structure."""
        # Replace multiple consecutive line breaks with double line breaks
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)

        # Remove line breaks that split sentences inappropriately
        # But preserve intentional paragraph breaks
        lines = content.split('\n')
        cleaned_lines = []

        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                # Empty line - preserve as paragraph break if not duplicate
                if cleaned_lines and cleaned_lines[-1] != '':
                    cleaned_lines.append('')
                continue

            # If the previous line ended with sentence-ending punctuation,
            # or this line starts with a capital letter after whitespace,
            # treat as a new paragraph
            if (cleaned_lines and
                    not cleaned_lines[-1].endswith(('.', '!', '?', ':', ';')) and
                    not line[0].isupper() and
                    cleaned_lines[-1] != ''):
                # Likely a line break in the middle of a sentence
                cleaned_lines[-1] = cleaned_lines[-1] + ' ' + line
            else:
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    def extract_plain_text(self, html_content: str) -> str:
        """
        Extract plain text from HTML content with better formatting preservation.

        Args:
            html_content: HTML content to convert

        Returns:
            Plain text content
        """
        if not html_content:
            return ""

        # Replace certain HTML tags with appropriate text formatting
        # Fixed: Changed to proper dict with colon syntax
        replacements = {
            r'<br\s*/?>': '\n',
            r'</p>': '\n\n',
            r'</?div[^>]*>': '\n',
            r'</?h[1-6][^>]*>': '\n',
            r'<li[^>]*>': '\n• ',
            r'</li>': '',
            r'</?ul[^>]*>': '\n',
            r'</?ol[^>]*>': '\n',
        }

        content = html_content
        for pattern, replacement in replacements.items():
            content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)

        # Remove remaining HTML tags
        content = self.remove_html_tags(content)

        # Clean up the result
        content = self.decode_html_entities(content)
        content = self.normalize_whitespace(content)
        content = self.clean_line_breaks(content)

        return content.strip()

    def truncate_content(self, content: str, max_length: int = 50000, preserve_sentences: bool = True) -> str:
        """
        Truncate content to a maximum length, optionally preserving sentence boundaries.

        Args:
            content: Content to truncate
            max_length: Maximum length in characters
            preserve_sentences: Whether to truncate at sentence boundaries

        Returns:
            Truncated content
        """
        if len(content) <= max_length:
            return content

        if not preserve_sentences:
            return content[:max_length] + "..."

        # Try to truncate at sentence boundary
        truncated = content[:max_length]

        # Find the last sentence boundary
        sentence_endings = ['.', '!', '?']
        last_sentence_end = -1

        for ending in sentence_endings:
            pos = truncated.rfind(ending)
            if pos > last_sentence_end:
                last_sentence_end = pos

        if last_sentence_end > max_length * 0.8:  # Only truncate at sentence if we keep at least 80%
            return truncated[:last_sentence_end + 1] + "..."
        else:
            # Fallback to word boundary
            last_space = truncated.rfind(' ')
            if last_space > max_length * 0.9:
                return truncated[:last_space] + "..."
            else:
                return truncated + "..."

    def clean_for_ai_processing(self, content: str) -> str:
        """
        Clean content specifically for AI processing - removes elements that might confuse the AI.

        Args:
            content: Raw content

        Returns:
            Content optimized for AI processing
        """
        # Start with basic cleaning
        content = self.clean_email_content(content)

        # Remove URLs from the text (keep them for link extraction, but remove from AI input)
        # This prevents the AI from trying to summarize URLs themselves
        content = re.sub(r'https?://\S+', '[LINK]', content)

        # Remove email addresses
        content = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', content)

        # Remove phone numbers
        content = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', content)

        # Clean up excessive punctuation
        content = re.sub(r'[.]{3,}', '...', content)
        content = re.sub(r'[!]{2,}', '!', content)
        content = re.sub(r'[?]{2,}', '?', content)

        # Remove excessive capitalization (but preserve acronyms)
        words = content.split()
        cleaned_words = []

        for word in words:
            # If word is all caps and longer than 3 characters, and not an acronym
            if (len(word) > 3 and word.isupper() and
                    not re.match(r'^[A-Z]{2,4}$', word) and  # Likely acronym
                    not word.replace('.', '').isupper()):  # Has punctuation
                cleaned_words.append(word.capitalize())
            else:
                cleaned_words.append(word)

        content = ' '.join(cleaned_words)

        # Final whitespace normalization
        content = self.normalize_whitespace(content)

        return content.strip()
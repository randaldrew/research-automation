// frontend/src/utils/textUtils.ts

/**
 * Utility functions for text processing and formatting
 */

export const textUtils = {
  /**
   * Truncate text to specified length with ellipsis
   */
  truncate: (text: string, maxLength: number, options?: {
    wordBoundary?: boolean;
    suffix?: string;
  }): string => {
    const { wordBoundary = true, suffix = '...' } = options || {};

    if (text.length <= maxLength) {
      return text;
    }

    let truncated = text.slice(0, maxLength - suffix.length);

    if (wordBoundary) {
      // Find the last space to avoid cutting words
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) { // Don't go back too far
        truncated = truncated.slice(0, lastSpace);
      }
    }

    return truncated + suffix;
  },

  /**
   * Extract excerpt from longer text (first paragraph or sentence)
   */
  getExcerpt: (text: string, maxLength: number = 200): string => {
    if (!text) return '';

    // Try to get first paragraph
    const firstParagraph = text.split('\n\n')[0];
    if (firstParagraph.length <= maxLength) {
      return firstParagraph;
    }

    // If first paragraph is too long, try first sentence
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence.length <= maxLength) {
      return firstSentence + '.';
    }

    // Fall back to truncation
    return textUtils.truncate(text, maxLength);
  },

  /**
   * Highlight search terms in text
   */
  highlightSearch: (text: string, searchTerm: string): string => {
    if (!searchTerm || !text) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },

  /**
   * Clean and normalize text
   */
  clean: (text: string): string => {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .trim();
  },

  /**
   * Convert text to slug (URL-friendly)
   */
  slugify: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
  },

  /**
   * Count words in text
   */
  wordCount: (text: string): number => {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  },

  /**
   * Estimate reading time (average 200 words per minute)
   */
  readingTime: (text: string, wordsPerMinute: number = 200): string => {
    const words = textUtils.wordCount(text);
    const minutes = Math.ceil(words / wordsPerMinute);

    if (minutes < 1) {
      return '< 1 min read';
    } else if (minutes === 1) {
      return '1 min read';
    } else {
      return `${minutes} min read`;
    }
  },

  /**
   * Extract plain text from HTML
   */
  stripHTML: (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  },

  /**
   * Format tags consistently
   */
  formatTags: (tags: string | string[]): string[] => {
    if (!tags) return [];

    const tagArray = Array.isArray(tags) ? tags : tags.split(/[,;]/);

    return tagArray
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
  },

  /**
   * Search text for keywords (case-insensitive)
   */
  searchText: (text: string, searchTerms: string[]): boolean => {
    if (!searchTerms || searchTerms.length === 0) return true;

    const lowerText = text.toLowerCase();
    return searchTerms.some(term =>
      lowerText.includes(term.toLowerCase())
    );
  },

  /**
   * Get text similarity score (simple implementation)
   */
  getSimilarity: (text1: string, text2: string): number => {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  },

  /**
   * Format numbers with appropriate units
   */
  formatCount: (count: number): string => {
    if (count < 1000) {
      return count.toString();
    } else if (count < 1000000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return `${(count / 1000000).toFixed(1)}M`;
    }
  },

  /**
   * Capitalize first letter of each word
   */
  titleCase: (text: string): string => {
    return text.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  },

  /**
   * Check if text contains URLs
   */
  containsURL: (text: string): boolean => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
  },

  /**
   * Extract URLs from text
   */
  extractURLs: (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }
};
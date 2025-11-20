// frontend/src/utils/dateUtils.ts

/**
 * Utility functions for date formatting and manipulation
 */

export const dateUtils = {
  /**
   * Format date for display in UI
   */
  formatDate: (date: string | Date, options?: {
    includeTime?: boolean;
    relative?: boolean;
    short?: boolean;
  }): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const { includeTime = false, relative = false, short = false } = options || {};

    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    if (relative) {
      return dateUtils.getRelativeTime(dateObj);
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: short ? 'short' : 'long',
      day: 'numeric',
    };

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
    }

    return dateObj.toLocaleDateString('en-US', formatOptions);
  },

  /**
   * Get relative time (e.g., "2 hours ago", "yesterday")
   */
  getRelativeTime: (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years !== 1 ? 's' : ''} ago`;
    }
  },

  /**
   * Format duration in a human-readable way
   */
  formatDuration: (startTime: string | Date, endTime?: string | Date): string => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const end = endTime ? (typeof endTime === 'string' ? new Date(endTime) : endTime) : new Date();

    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours > 0) {
      const remainingMinutes = diffMinutes % 60;
      return `${diffHours}h ${remainingMinutes}m`;
    } else if (diffMinutes > 0) {
      const remainingSeconds = diffSeconds % 60;
      return `${diffMinutes}m ${remainingSeconds}s`;
    } else {
      return `${diffSeconds}s`;
    }
  },

  /**
   * Check if date is today
   */
  isToday: (date: string | Date): boolean => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    return dateObj.getDate() === today.getDate() &&
           dateObj.getMonth() === today.getMonth() &&
           dateObj.getFullYear() === today.getFullYear();
  },

  /**
   * Check if date is this week
   */
  isThisWeek: (date: string | Date): boolean => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return dateObj >= weekStart && dateObj <= weekEnd;
  },

  /**
   * Get start of week
   */
  getWeekStart: (date?: Date): Date => {
    const dateObj = date || new Date();
    const weekStart = new Date(dateObj);
    weekStart.setDate(dateObj.getDate() - dateObj.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  },

  /**
   * Get date range for filtering
   */
  getDateRange: (period: 'today' | 'week' | 'month' | 'year'): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today':
        // Already set correctly
        break;
      case 'week':
        start = dateUtils.getWeekStart(now);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'year':
        start.setMonth(0, 1);
        break;
    }

    return { start, end };
  },

  /**
   * Parse ISO string safely
   */
  parseISOString: (isoString: string): Date | null => {
    try {
      const date = new Date(isoString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
};
// frontend/src/utils/api.tsx
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  CompleteSetupConfig,
  EmailConfig,
  APIKeysConfig,
  RSSFeedConfig
} from '@/types/config';

// API Response types
export interface APIResponse<T = any> {
  data: T;
  message?: string;
  success?: boolean;
}

// Settings-specific response types
export interface CurrentSettingsResponse {
  email: EmailConfig;
  api_keys: APIKeysConfig;
  rss_feeds: Record<string, RSSFeedConfig>;
  processing: {
    max_articles_per_run: number;
    enable_link_enrichment: boolean;
    max_links_to_enrich: number;
    claude_model: string;
    auto_generate_weekly_summary: boolean;
    weekly_summary_min_days: number;
  };
  system: {
    data_directory: string;
    database_path: string;
    obsidian_vault_path: string;
    exports_directory: string;
    log_level: string;
    frontend_url: string;
    backend_port: number;
  };
}

export interface SettingsUpdateRequest {
  email?: EmailConfig;
  api_keys?: APIKeysConfig;
  rss_feeds?: Record<string, RSSFeedConfig>;
  processing?: {
    max_articles_per_run?: number;
    enable_link_enrichment?: boolean;
    max_links_to_enrich?: number;
    claude_model?: string;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'error' | 'warning';
  details: any;
  timestamp: string;
}

// Create axios instance with default configuration
const createAPIClient = (): AxiosInstance => {
  // Use localhost for development, relative path for production
  const baseURL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      console.log(`API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      console.error(`API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
      return Promise.reject(error);
    }
  );

  return client;
};

const apiClient = createAPIClient();

// ============================================================================
// COMPLETE API METHODS - SINGLE SOURCE OF TRUTH
// ============================================================================

export const apiMethods = {
  // Setup API methods
  setup: {
    getStatus: () => apiClient.get('/status'),
    getDefaults: () => apiClient.get('/defaults'),
    testEmail: (config: EmailConfig) => apiClient.post('/test/email', config),
    testClaude: (config: APIKeysConfig) => apiClient.post('/test/claude', config),
    testLinkPreview: (apiKey: string) => apiClient.post('/test/linkpreview', {}, {params: { api_key: apiKey }}),
    testRSS: (config: RSSFeedConfig) => apiClient.post('/test/rss', config),
    validate: (config: CompleteSetupConfig) => apiClient.post('/validate', config),
    complete: (config: CompleteSetupConfig) => apiClient.post('/complete', config),
  },

  // Settings API methods
  settings: {
    getCurrentSettings: () => apiClient.get('/current'),
    saveSettings: (settings: SettingsUpdateRequest) => apiClient.put('/save', settings),
    resetToDefaults: () => apiClient.post('/reset'),
    createBackup: () => apiClient.get('/backup'),
    getHealth: () => apiClient.get('/health'),
    repairSettings: () => apiClient.post('/repair'),
  },

  // Processing API methods
  processing: {
    start: (options?: { force_reprocess?: boolean; max_items?: number }) =>
      apiClient.post('/process/start', options || {}),
    stop: () => apiClient.post('/process/stop'),
    getStatus: () => apiClient.get('/process/status'),
  },

  // Summaries API methods
  summaries: {
    getAll: (params?: { limit?: number; offset?: number; [key: string]: any }) =>
      apiClient.get('/summaries', { params }),
    getById: (id: number) => apiClient.get(`/summaries/${id}`),
    updateRead: (id: number, read: boolean) =>
      apiClient.patch(`/summaries/${id}`, { read }),
    updateStarred: (id: number, starred: boolean) =>
      apiClient.patch(`/summaries/${id}`, { starred }),
    delete: (id: number) => apiClient.delete(`/summaries/${id}`),
    search: (query: string, filters?: any) =>
      apiClient.get('/summaries/search', { params: { q: query, ...filters } }),
  },

  // Links API methods
  links: {
    getAll: (params?: { limit?: number; offset?: number; [key: string]: any }) =>
      apiClient.get('/links', { params }),
    getById: (id: number) => apiClient.get(`/links/${id}`),
    delete: (id: number) => apiClient.delete(`/links/${id}`),
    search: (query: string, filters?: any) =>
      apiClient.get('/links/search', { params: { q: query, ...filters } }),
    markVisited: (linkId: number) =>
      apiClient.put(`/links/${linkId}/visited`),
    getAnalytics: () => apiClient.get('/links/analytics'),
  },

  // Links API methods
  insights: {
  getAll: (params?: {
    limit?: number;
    offset?: number;
    source?: string;
    topic?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    apiClient.get('/insights', { params }),

  getById: (id: number) =>
    apiClient.get(`/insights/${id}`),

  search: (query: string, limit?: number) =>
    apiClient.get('/insights/search', { params: { query, limit } }),

  getAnalytics: () =>
    apiClient.get('/insights/analytics'),
},

  // Source management API methods
  sources: {
    getAllSources: () => apiClient.get('/sources/'),
    getAvailableTypes: () => apiClient.get('/sources/available-types'),
    createSource: (request: any) => apiClient.post('/sources/', request),
    getSource: (sourceId: string) => apiClient.get(`/sources/${sourceId}`),
    updateSource: (sourceId: string, request: any) => apiClient.put(`/sources/${sourceId}`, request),
    deleteSource: (sourceId: string) => apiClient.delete(`/sources/${sourceId}`),
    testSource: (sourceId: string) => apiClient.post(`/sources/${sourceId}/test`),
    testConfig: (request: any) => apiClient.post('/sources/test-config', request),
    enableSource: (sourceId: string) => apiClient.post(`/sources/${sourceId}/enable`),
    disableSource: (sourceId: string) => apiClient.post(`/sources/${sourceId}/disable`),
  },

  // Data & Cross-cutting API methods (for compatibility with existing hooks)
  data: {
    // Core data methods (for existing hook compatibility)
    getSummaries: (limit: number = 10, offset: number = 0) =>
      apiClient.get('/summaries', { params: { limit, offset } }),

    getLinks: (limit: number = 20, offset: number = 0, filters?: {
      source?: string;
      enriched?: boolean;
      visited?: boolean;
    }) => {
      const params: any = { limit, offset };
      if (filters?.source) params.source = filters.source;
      if (filters?.enriched !== undefined) params.enriched = filters.enriched;
      if (filters?.visited !== undefined) params.visited = filters.visited;

      return apiClient.get('/links', { params });
    },

    getLinksAnalytics: () => apiClient.get('/links/analytics'),

    markLinkVisited: (linkId: number) => apiClient.put(`/links/${linkId}/visited`),

    // Unified search across content types
    search: (query: string, type: string = 'summaries', limit: number = 20) =>
      apiClient.post('/search', { query, type, limit }),

    // Statistics and analytics
    getStatistics: () => apiClient.get('/statistics'),

    // Export functionality
    exportData: (format: string = 'json') =>
      apiClient.get('/export', { params: { format } }),

    // System utilities
    getRecentLogs: (lines: number = 100) =>
      apiClient.get('/logs', { params: { lines } }),
    testAllComponents: () => apiClient.get('/test'),
  },

  // Export API methods
  exports: {
    createExport: (format: string, options?: any) =>
      apiClient.post('/exports', { format, ...options }),
    getExports: () => apiClient.get('/exports'),
    downloadExport: (id: string) => apiClient.get(`/exports/${id}/download`, {
      responseType: 'blob'
    }),
  },

  // Health check
  health: {
    check: () => apiClient.get('/health'),
  },
};

// ============================================================================
// API UTILITIES - COMPLETE SET
// ============================================================================

export const apiUtils = {
  // Response data extraction
  extractData: <T,>(response: AxiosResponse<APIResponse<T>>): T => response.data.data,

  // Error handling
  handleError: (error: any): string => {
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    } else if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },

  // Response validation
  isSuccessResponse: (response: AxiosResponse<APIResponse>): boolean => {
    return response.status >= 200 && response.status < 300 && response.data.success !== false;
  },

  // Search response handling
  handleSearchResponse: (response: any) => {
    const data = response.data;
    return {
      results: data.results || [],
      total: data.total || 0,
      type: data.type || 'summaries',
      query: data.query || ''
    };
  },

  // Paginated response handling
  handlePaginatedResponse: (response: any) => {
    const data = response.data;
    return {
      data: data.summaries || data.data || data.links || [],
      total: data.total || 0,
      limit: data.limit || 10,
      offset: data.offset || 0,
      has_more: data.has_more || false
    };
  },

  // API error standardization
  handleApiError: (error: any) => {
    return {
      message: error.response?.data?.detail || error.message || 'Unknown error',
      status: error.response?.status || 500,
      code: error.response?.data?.code || 'UNKNOWN_ERROR'
    };
  }
};

export default apiClient;
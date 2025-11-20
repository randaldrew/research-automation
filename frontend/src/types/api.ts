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
    ? 'http://localhost:8000/api'
    : '/api';

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

// API Methods organized by domain
export const apiMethods = {
  // Setup API methods (existing)
  setup: {
    getStatus: () => apiClient.get('/setup/status'),
    testEmail: (config: EmailConfig) => apiClient.post('/setup/test/email', config),
    testClaude: (config: APIKeysConfig) => apiClient.post('/setup/test/claude', config),
    testLinkPreview: (config: APIKeysConfig) => apiClient.post('/setup/test/linkpreview', config),
    testRSS: (config: RSSFeedConfig) => apiClient.post('/setup/test/rss', config),
    validate: (config: CompleteSetupConfig) => apiClient.post('/setup/validate', config),
    complete: (config: CompleteSetupConfig) => apiClient.post('/setup/complete', config),
  },

  // Settings API methods
  settings: {
    // Get current settings with sensitive data masked
    getCurrentSettings: (): Promise<AxiosResponse<CurrentSettingsResponse>> =>
      apiClient.get('/settings/current'),

    // Save updated settings
    saveSettings: (settings: SettingsUpdateRequest): Promise<AxiosResponse<APIResponse>> =>
      apiClient.post('/settings/save', settings),

    // Reset settings to defaults (preserves email/API keys)
    resetToDefaults: (): Promise<AxiosResponse<APIResponse>> =>
      apiClient.post('/settings/reset'),

    // Create backup of current settings
    createBackup: (): Promise<AxiosResponse<APIResponse>> =>
      apiClient.get('/settings/backup'),

    // Health check for settings system
    getHealth: (): Promise<AxiosResponse<HealthCheckResponse>> =>
      apiClient.get('/settings/health'),

    // Repair settings system
    repairSettings: (): Promise<AxiosResponse<APIResponse>> =>
      apiClient.post('/settings/repair'),
  },

  // Processing API methods (existing)
  processing: {
    start: (options?: { force_reprocess?: boolean; max_items?: number }) =>
      apiClient.post('/processing/start', options || {}),
    stop: () => apiClient.post('/processing/stop'),
    getStatus: () => apiClient.get('/processing/status'),
  },

  // Data API methods (existing)
  summaries: {
    getAll: (params?: any) => apiClient.get('/summaries', { params }),
    getById: (id: number) => apiClient.get(`/summaries/${id}`),
    updateRead: (id: number, read: boolean) => 
      apiClient.patch(`/summaries/${id}`, { read }),
    updateStarred: (id: number, starred: boolean) => 
      apiClient.patch(`/summaries/${id}`, { starred }),
    delete: (id: number) => apiClient.delete(`/summaries/${id}`),
    search: (query: string, filters?: any) => 
      apiClient.get('/summaries/search', { params: { q: query, ...filters } }),
  },

  links: {
    getAll: (params?: any) => apiClient.get('/links', { params }),
    getById: (id: number) => apiClient.get(`/links/${id}`),
    delete: (id: number) => apiClient.delete(`/links/${id}`),
    search: (query: string, filters?: any) => 
      apiClient.get('/links/search', { params: { q: query, ...filters } }),
  },

  // Insights API methods
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
  // Data & statistics endpoints

    data: {
    getStatistics: () => apiClient.get('/statistics'),
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

// Utility functions for API responses
export const apiUtils = {
  extractData: <T,>(response: AxiosResponse<APIResponse<T>>): T => response.data.data,
  
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

  isSuccessResponse: (response: AxiosResponse<APIResponse>): boolean => {
    return response.status >= 200 && response.status < 300 && response.data.success !== false;
  }
};

export default apiClient;
// Types for Research Automation

export interface Summary {
  id?: number;
  title: string;
  source: string;
  source_type: string;
  date: string;
  summary: string;
  questions: string[];
  tags: string[];
  links?: Link[];
  content_length?: number;
  chunks_processed?: number;
  created_at?: string;
  read?: boolean;
  starred?: boolean;
}

export interface Link {
  id?: number;
  url: string;
  title: string;
  description?: string;
  image_url?: string;
  source: string;
  date: string;
  tags?: string[];
  enriched?: boolean;
  visited?: boolean;
}

export interface Insight {
  id?: number;
  source: string;
  topic: string;
  insight: string;
  tags: string[];
  date: string;
  created_at?: string;
}

export interface Question {
  id?: number;
  source: string;
  question: string;
  topic: string;
  date: string;
  answered?: boolean;
}

export interface ProcessingState {
  status: 'idle' | 'running' | 'completed' | 'error';
  current_step: string;
  progress: number;
  total_steps: number;
  start_time?: string;
  end_time?: string;
  error_message?: string;
  results: {
    content_fetched?: number;
    summaries_generated?: number;
    links_processed?: number;
    insights_extracted?: number;
    exports_generated?: number;
  };
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: any;
}

export interface Statistics {
  database: {
    summaries_count: number;
    insights_count: number;
    questions_count: number;
    links_count: number;
    processing_runs_count: number;
    summaries_last_week: number;
    top_sources: Array<{source: string; count: number}>;
    top_tags: Array<{tag: string; count: number}>;
  };
  processing: {
    current_status: string;
    last_run?: string;
    total_processing_runs: number;
  };
  system: {
    websocket_connections: number;
    database_path: string;
  };
}

// Configuration Types
export interface EmailConfig {
  server: string;
  username: string;
  password: string;
  folder: string;
  smtp_server: string;
  smtp_port: number;
  notification_email: string;
}

export interface APIKeysConfig {
  claude_api_key: string;
  linkpreview_api_key?: string;
}

export interface RSSFeedConfig {
  name: string;
  rss_url: string;
  episodes_to_fetch: number;
}

export interface ProcessingConfig {
  max_articles_per_run: number;
  enable_link_enrichment: boolean;
  max_links_to_enrich: number;
  claude_model: string;
}

export interface SetupConfig {
  email: EmailConfig;
  api_keys: APIKeysConfig;
  rss_feeds: Record<string, RSSFeedConfig>;
  processing: ProcessingConfig;
}

export interface SetupStatus {
  is_configured: boolean;
  missing_requirements: string[];
  api_keys_valid: {
    claude: boolean;
    linkpreview: boolean;
    email: boolean;
  };
  configuration: {
    email_configured: boolean;
    claude_configured: boolean;
    linkpreview_configured: boolean;
    obsidian_path_set: boolean;
  };
  paths: {
    data_directory: string;
    database_path: string;
    obsidian_vault: string;
    exports_directory: string;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      details: string;
    };
  };
}

export interface ExportFormat {
  name: string;
  key: string;
  description: string;
  file_extension: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  type?: 'summaries' | 'links' | 'insights';
}

export interface SearchResults {
  type: string;
  query: string;
  results: Summary[] | Link[] | Insight[];
  total: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface ProcessingResponse {
  message: string;
  status: string;
  current_step?: string;
  progress?: number;
  websocket_url?: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'status_update' | 'processing_update' | 'processing_complete' | 'processing_error' | 'pong';
  data?: any;
}

// Form Types
export interface SetupFormData {
  step: number;
  email: Partial<EmailConfig>;
  apiKeys: Partial<APIKeysConfig>;
  rssFeeds: Record<string, Partial<RSSFeedConfig>>;
  processing: Partial<ProcessingConfig>;
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

// Navigation Types
export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  badge?: string | number;
}

// Dashboard Types
export interface DashboardCard {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: string;
  };
  icon?: string;
}

export interface RecentActivity {
  id: string;
  type: 'summary' | 'processing' | 'export';
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'error' | 'warning';
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export interface ProgressBarProps extends BaseComponentProps {
  value: number;
  max?: number;
  showPercentage?: boolean;
  label?: string;
}

export interface StatusBadgeProps extends BaseComponentProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'idle';
  text?: string;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Theme Types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}
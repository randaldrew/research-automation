// Configuration types for Research Automation frontend
// These types match the backend Pydantic models

// Email Configuration
export interface EmailConfig {
  server: string;
  username: string;
  password: string;
  folder: string;
  smtp_server: string;
  smtp_port: number;
  notification_email: string;
}

// API Keys Configuration
export interface APIKeysConfig {
  claude_api_key: string;
  linkpreview_api_key?: string;
}

// RSS Feed Configuration
export interface RSSFeedConfig {
  name: string;
  rss_url: string;
  episodes_to_fetch: number;
}

// Processing Configuration
export interface ProcessingConfig {
  max_articles_per_run: number;
  enable_link_enrichment: boolean;
  max_links_to_enrich: number;
  claude_model: string;
  auto_generate_weekly_summary: boolean;
  weekly_summary_min_days: number;
}

// System Configuration (for settings page)
export interface SystemConfig {
  data_directory: string;
  database_path: string;
  obsidian_vault_path: string;
  obsidian_summaries_folder: string;
  exports_directory: string;
  log_level: string;
  frontend_url: string;
  backend_port: number;
}

export interface ObsidianConfig {
  enabled: boolean;
  obsidian_vault_path: string;
  obsidian_summaries_folder: string;
}

// Complete Setup Configuration (for initial setup)
export interface CompleteSetupConfig {
  email: EmailConfig;
  api_keys: APIKeysConfig;
  rss_feeds: Record<string, RSSFeedConfig>;
  processing: ProcessingConfig;
  system: ObsidianConfig;
}

// Application Settings (for settings page - includes system config)
export interface AppSettings {
  email: EmailConfig;
  apiKeys: APIKeysConfig;
  processing: ProcessingConfig;
  system: SystemConfig;
}

// Setup Status
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

// Test Result for API validation
export interface TestResult {
  success: boolean;
  error?: string;
  results?: any;
  message?: string;
}

// Default configurations
export const defaultEmailConfig: EmailConfig = {
  server: 'imap.gmail.com',
  username: '',
  password: '',
  folder: 'INBOX',
  smtp_server: 'smtp.gmail.com',
  smtp_port: 587,
  notification_email: ''
};

export const defaultAPIKeysConfig: APIKeysConfig = {
  claude_api_key: '',
  linkpreview_api_key: ''
};

export const defaultProcessingConfig: ProcessingConfig = {
  max_articles_per_run: 20,
  enable_link_enrichment: true,
  max_links_to_enrich: 10,
  claude_model: 'claude-sonnet-4-5',
  auto_generate_weekly_summary: true,
  weekly_summary_min_days: 3
};

export const defaultSystemConfig: SystemConfig = {
  data_directory: '/app/data',
  database_path: '/app/data/database/insights.db',
  obsidian_vault_path: '',
  obsidian_summaries_folder: 'Newsletter Summaries',
  exports_directory: '/app/data/exports',
  log_level: 'INFO',
  frontend_url: 'http://localhost:3000',
  backend_port: 8000
};

export const defaultObsidianConfig: ObsidianConfig = {
  enabled: false,
  obsidian_vault_path: '',
  obsidian_summaries_folder: 'Newsletter Summaries'
};

export const defaultRSSFeeds: Record<string, RSSFeedConfig> = {};
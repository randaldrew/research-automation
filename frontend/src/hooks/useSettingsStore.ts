// frontend/src/hooks/useSettingsStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '@/utils/api';
import {
  AppSettings,
  EmailConfig,
  APIKeysConfig,
  ProcessingConfig,
  TestResult
} from '@/types/config';

const extractErrorMessage = (error: any): string => {
  if (!error.response?.data?.detail) {
    return error.message || 'An unknown error occurred';
  }
  const detail = error.response.data.detail;
  if (Array.isArray(detail)) {
    return detail.map(err => err.msg || String(err)).join(', ');
  }
  return String(detail);
};

export interface SettingsStatus {
  is_configured: boolean;
  missing_requirements: string[];
  api_keys_valid: {
    claude: boolean;
    linkpreview: boolean;
    email: boolean;
  };
}

interface SettingsState {
  // Data
  settings: AppSettings | null;
  status: SettingsStatus | null;
  originalSettings: AppSettings | null; // For change tracking

  // Test results
  emailTestResult: TestResult | null;
  claudeTestResult: TestResult | null;
  linkpreviewTestResult: TestResult | null;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  activeSection: 'email' | 'api' | 'sources' | 'processing' | 'system';

  // Actions
  loadSettings: () => Promise<void>;
  loadStatus: () => Promise<void>;
  updateEmailSettings: (settings: Partial<EmailConfig>) => void;
  updateAPISettings: (settings: Partial<APIKeysConfig>) => void;
  updateProcessingSettings: (settings: Partial<ProcessingConfig>) => void;
  updateSystemSettings: (settings: Partial<AppSettings['system']>) => void;

  // Testing
  testEmailSettings: () => Promise<void>;
  testClaudeAPI: () => Promise<void>;
  testLinkPreviewAPI: () => Promise<void>;

  // Save/Reset
  saveSettings: () => Promise<void>;
  resetSettings: () => void;
  discardChanges: () => void;

  // Navigation
  setActiveSection: (section: SettingsState['activeSection']) => void;

  // Utility
  clearError: () => void;
}

console.log("🏪 Creating useSettingsStore...");
export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      settings: null,
      status: null,
      originalSettings: null,
      emailTestResult: null,
      claudeTestResult: null,
      linkpreviewTestResult: null,
      isLoading: false,
      isSaving: false,
      isTesting: false,
      error: null,
      hasUnsavedChanges: false,
      activeSection: 'email',

      // Load current settings using the NEW settings API
      loadSettings: async () => {
        console.log("🔍 loadSettings called");
        set({ isLoading: true, error: null });

        try {
          console.log("🌐 Making API call...");
          const response = await apiMethods.settings.getCurrentSettings();
          console.log("📥 Raw API response:", response);
          console.log("📋 Response data:", response.data);
          const backendSettings = response.data.settings;
          console.log("🔑 Backend API keys:", backendSettings.api_keys);

          // Convert backend format to frontend AppSettings format
          const appSettings: AppSettings = {
              email: backendSettings.email || {
                server: '',
                username: '',
                password: '',
                folder: 'INBOX',
                smtp_server: '',
                smtp_port: 587,
                notification_email: ''
              },
              apiKeys: backendSettings.api_keys || {
                claude_api_key: '',
                linkpreview_api_key: ''
              },
              processing: backendSettings.processing || {
                max_articles_per_run: 10,
                enable_link_enrichment: true,
                max_links_to_enrich: 50,
                claude_model: 'claude-3-haiku-20240307'
              },
              system: backendSettings.system || {
                data_directory: './data',
                database_path: './data/database/insights.db',
                obsidian_vault_path: '',
                exports_directory: './data/exports',
                log_level: 'INFO',
                frontend_url: 'http://localhost:3000',
                backend_port: 8000
              }
            };
          console.log("💾 About to set store state with:", appSettings);
          set({
            settings: appSettings,
            originalSettings: JSON.parse(JSON.stringify(appSettings)), // Deep copy
            isLoading: false,
            hasUnsavedChanges: false
          });
          console.log("✅ Store state set, current state:", get());

        } catch (error: any) {
          console.error("❌ loadSettings error:", error);
          const errorMessage = extractErrorMessage(error);
          set({
            error: errorMessage,
            isLoading: false
          });
          console.error('Failed to load settings:', error);
        }
      },

      // Load status from setup API (for compatibility)
      loadStatus: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.setup.getStatus();
          set({
            status: response.data,
            isLoading: false
          });
        } catch (error: any) {
          set({
            error: 'Failed to load status',
            isLoading: false
          });
        }
      },

      // Update methods
      updateEmailSettings: (emailUpdates: Partial<EmailConfig>) => {
        set(state => {
          if (!state.settings) return state;

          const updated = {
            ...state.settings,
            email: { ...state.settings.email, ...emailUpdates }
          };

          return {
            settings: updated,
            hasUnsavedChanges: JSON.stringify(updated) !== JSON.stringify(state.originalSettings)
          };
        });
      },

      updateAPISettings: (apiUpdates: Partial<APIKeysConfig>) => {
        set(state => {
          if (!state.settings) return state;

          const updated = {
            ...state.settings,
            apiKeys: { ...state.settings.apiKeys, ...apiUpdates }
          };

          return {
            settings: updated,
            hasUnsavedChanges: JSON.stringify(updated) !== JSON.stringify(state.originalSettings)
          };
        });
      },

      updateProcessingSettings: (processingUpdates: Partial<ProcessingConfig>) => {
        set(state => {
          if (!state.settings) return state;

          const updated = {
            ...state.settings,
            processing: { ...state.settings.processing, ...processingUpdates }
          };

          return {
            settings: updated,
            hasUnsavedChanges: JSON.stringify(updated) !== JSON.stringify(state.originalSettings)
          };
        });
      },

      updateSystemSettings: (systemUpdates: Partial<AppSettings['system']>) => {
        set(state => {
          if (!state.settings) return state;

          const updated = {
            ...state.settings,
            system: { ...state.settings.system, ...systemUpdates }
          };

          return {
            settings: updated,
            hasUnsavedChanges: JSON.stringify(updated) !== JSON.stringify(state.originalSettings)
          };
        });
      },

      // Testing methods
      testEmailSettings: async () => {
        const { settings } = get();
        if (!settings) return;

        set({ isTesting: true });

        try {
          const response = await apiMethods.setup.testEmail(settings.email);
          set({ emailTestResult: response.data, isTesting: false });
        } catch (error: any) {
          set({
            emailTestResult: {
              success: false,
              error: extractErrorMessage(error)
            },
            isTesting: false
          });
        }
      },

      // API test functions
      testClaudeAPI: async () => {
          const {settings} = get();
          if (!settings?.apiKeys.claude_api_key) return;

          // Show success message for already configured keys
          if (settings.apiKeys.claude_api_key === '***MASKED***') {
              set({
                  claudeTestResult: {
                      success: true,
                      message: 'Claude API key is already configured and working! Enter a new key to test a different one.'
                  }
              });
              return;
          }

          set({isTesting: true});

          try {
              const response = await apiMethods.setup.testClaude(settings.apiKeys);
              set({claudeTestResult: response.data, isTesting: false});
          } catch (error: any) {
              set({
                  claudeTestResult: {
                      success: false,
                      error: extractErrorMessage(error)
                  },
                  isTesting: false
              });
          }
      },

      testLinkPreviewAPI: async () => {
          const {settings} = get();
          if (!settings?.apiKeys.linkpreview_api_key) return;

          // Show success message for already configured keys
          if (settings.apiKeys.linkpreview_api_key === '***MASKED***') {
              set({
                  linkpreviewTestResult: {
                      success: true,
                      message: 'LinkPreview API key is already configured and working! Enter a new key to test a different one.'
                  }
              });
              return;
          }

          set({isTesting: true});

          try {
              const response = await apiMethods.setup.testLinkPreview(settings.apiKeys.linkpreview_api_key);
              set({linkpreviewTestResult: response.data, isTesting: false});
          } catch (error: any) {
              set({
                  linkpreviewTestResult: {
                      success: false,
                      error: extractErrorMessage(error)
                  },
                  isTesting: false
              });
          }
      },

      // Save settings using the NEW settings API
      saveSettings: async () => {
          const {settings} = get();
          if (!settings) return;

          set({isSaving: true, error: null});

          try {
              // Convert frontend format to backend format - ONLY include properly configured sections
              const settingsUpdateRequest: any = {};

              // Only include email if both required fields are properly configured
              if (settings.email.username &&
                  settings.email.notification_email &&
                  settings.email.username.includes('@') &&
                  settings.email.notification_email.includes('@')) {
                  settingsUpdateRequest.email = settings.email;
              }

              // Only include API keys if claude_api_key exists
              if (settings.apiKeys.claude_api_key && settings.apiKeys.claude_api_key.trim() !== '') {
                  settingsUpdateRequest.api_keys = settings.apiKeys;
              }

              // Always include processing (this is what you want to save)
              settingsUpdateRequest.processing = settings.processing;

              // Always include system settings (for Obsidian configuration)
              settingsUpdateRequest.system = settings.system;

              console.log('Saving settings:', settingsUpdateRequest);
              console.log('Processing config:', settings.processing);

              const response = await apiMethods.settings.saveSettings(settingsUpdateRequest);

              // Update originalSettings to match current settings (no longer "unsaved")
              set(state => ({
                  originalSettings: state.settings ? JSON.parse(JSON.stringify(state.settings)) : null,
                  hasUnsavedChanges: false,
                  isSaving: false,
                  error: null
              }));

              console.log('Settings saved successfully:', response.data);

          } catch (error: any) {
              const errorMessage = extractErrorMessage(error);
              set({
                  error: errorMessage,
                  isSaving: false
              });
              console.error('Failed to save settings:', error);
          }
      },

      // Reset settings using the NEW settings API
      resetSettings: async () => {
        set({ isLoading: true, error: null });

        try {
          await apiMethods.settings.resetToDefaults();

          // Reload settings after reset
          await get().loadSettings();

        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to reset settings';
          set({
            error: errorMessage,
            isLoading: false
          });
        }
      },

      // Discard unsaved changes
      discardChanges: () => {
        set(state => ({
          settings: state.originalSettings ? JSON.parse(JSON.stringify(state.originalSettings)) : state.settings,
          hasUnsavedChanges: false,
          emailTestResult: null,
          claudeTestResult: null,
          linkpreviewTestResult: null,
        }));
      },

      // Set active section
      setActiveSection: (section: SettingsState['activeSection']) => {
        set({ activeSection: section });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },


    }),
    { name: 'settings-store' }
  )
);


// frontend/src/hooks/useSetupStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '@/utils/api';

// Import types from centralized config.ts
import type {
  EmailConfig,
  APIKeysConfig,
  RSSFeedConfig,
  ProcessingConfig,
  ObsidianConfig,
  CompleteSetupConfig,
  TestResult,
} from '@/types/config';

import {
  defaultEmailConfig,
  defaultAPIKeysConfig,
  defaultProcessingConfig,
  defaultObsidianConfig,
  defaultRSSFeeds,
} from '@/types/config';

interface SetupState {
  // Current step (0-based)
  currentStep: number;

  // Configuration data
  emailConfig: EmailConfig;
  apiKeysConfig: APIKeysConfig;
  rssFeeds: Record<string, RSSFeedConfig>;
  processingConfig: ProcessingConfig;
  obsidianConfig: ObsidianConfig;

  // Test results
  emailTestResult: TestResult | null;
  claudeTestResult: TestResult | null;
  linkpreviewTestResult: TestResult | null;
  rssTestResults: Record<string, TestResult>;

  // UI state
  isLoading: boolean;
  isTesting: boolean;
  error: string | null;
  isConfigured: boolean;

  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;

  // Configuration updates
  updateEmailConfig: (config: Partial<EmailConfig>) => void;
  updateAPIKeysConfig: (config: Partial<APIKeysConfig>) => void;
  updateProcessingConfig: (config: Partial<ProcessingConfig>) => void;
  updateObsidianConfig: (config: Partial<ObsidianConfig>) => void;
  addRSSFeed: (id: string, config: RSSFeedConfig) => void;
  removeRSSFeed: (id: string) => void;

  // API calls
  loadDefaults: () => Promise<void>;
  loadStatus: () => Promise<void>;
  testEmailConfig: () => Promise<void>;
  testClaudeAPI: () => Promise<void>;
  testLinkPreviewAPI: () => Promise<void>;
  testRSSFeed: (id: string) => Promise<void>;
  validateConfiguration: () => Promise<boolean>;
  completeSetup: () => Promise<void>;

  // Utility
  reset: () => void;

}

export const useSetupStore = create<SetupState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentStep: 0,
      emailConfig: defaultEmailConfig,
      apiKeysConfig: defaultAPIKeysConfig,
      rssFeeds: defaultRSSFeeds,
      processingConfig: defaultProcessingConfig,
      obsidianConfig: defaultObsidianConfig,
      emailTestResult: null,
      claudeTestResult: null,
      linkpreviewTestResult: null,
      rssTestResults: {},
      isLoading: false,
      isTesting: false,
      error: null,
      isConfigured: false,

      // Navigation actions
      setCurrentStep: (step: number) => {
        set({ currentStep: step });
      },

      nextStep: () => {
        set(state => ({ currentStep: state.currentStep + 1 }));
      },

      previousStep: () => {
        set(state => ({ currentStep: Math.max(0, state.currentStep - 1) }));
      },

      // Configuration update actions
      updateEmailConfig: (config: Partial<EmailConfig>) => {
        set(state => ({
          emailConfig: { ...state.emailConfig, ...config }
        }));
      },

      updateAPIKeysConfig: (config: Partial<APIKeysConfig>) => {
        set(state => ({
          apiKeysConfig: { ...state.apiKeysConfig, ...config }
        }));
      },

      updateProcessingConfig: (config: Partial<ProcessingConfig>) => {
        set(state => ({
          processingConfig: { ...state.processingConfig, ...config }
        }));
      },

      updateObsidianConfig: (config: Partial<ObsidianConfig>) => {
        set(state => ({
          obsidianConfig: { ...state.obsidianConfig, ...config }
        }));
      },

      addRSSFeed: (id: string, config: RSSFeedConfig) => {
        set(state => ({
          rssFeeds: { ...state.rssFeeds, [id]: config }
        }));
      },

      removeRSSFeed: (id: string) => {
        set(state => {
          const { [id]: _, ...rest } = state.rssFeeds;
          return { rssFeeds: rest };
        });
      },

      // API functions
      loadDefaults: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.setup.getDefaults();
          const defaults = response.data;

          // Batch all state updates together to prevent cascading
          set({
            emailConfig: defaults.email || defaultEmailConfig,
            apiKeysConfig: defaults.api_keys || defaultAPIKeysConfig,
            rssFeeds: defaults.rss_feeds || defaultRSSFeeds,
            processingConfig: defaults.processing || defaultProcessingConfig,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load defaults',
            isLoading: false
          });
        }
      },

      loadStatus: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.setup.getStatus();

          // Single state update to prevent cascading
          set({
            isConfigured: response.data.is_configured || false,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load status',
            isLoading: false
          });
        }
      },

      // Test functions
      testEmailConfig: async () => {
        const { emailConfig } = get();
        set({ isTesting: true, error: null });

        try {
          const response = await apiMethods.setup.testEmail(emailConfig);
          set({
            emailTestResult: response.data,
            isTesting: false
          });
        } catch (error: any) {
          set({
            emailTestResult: {
              success: false,
              error: error.response?.data?.detail || 'Email test failed'
            },
            isTesting: false
          });
        }
      },

      testClaudeAPI: async () => {
        const { apiKeysConfig } = get();
        set({ isTesting: true, error: null });

        try {
          const response = await apiMethods.setup.testClaude(apiKeysConfig);
          set({
            claudeTestResult: response.data,
            isTesting: false
          });
        } catch (error: any) {
          set({
            claudeTestResult: {
              success: false,
              error: error.response?.data?.detail || 'Claude API test failed'
            },
            isTesting: false
          });
        }
      },

      testLinkPreviewAPI: async () => {
          const { apiKeysConfig } = get();
          set({ isTesting: true, error: null });

          try {
            // Make sure we're passing a non-empty string
            const apiKey = apiKeysConfig.linkpreview_api_key?.trim();
            if (!apiKey) {
              throw new Error('LinkPreview API key is required');
            }

            const response = await apiMethods.setup.testLinkPreview(apiKey);
            set({
              linkpreviewTestResult: response.data,
              isTesting: false
            });
          } catch (error: any) {
            // Extract error message properly
            let errorMessage = 'LinkPreview API test failed';

            if (error.response?.data?.detail) {
              const detail = error.response.data.detail;
              if (typeof detail === 'string') {
                errorMessage = detail;
              } else if (Array.isArray(detail)) {
                errorMessage = detail.map(err => err.msg || JSON.stringify(err)).join(', ');
              } else {
                errorMessage = JSON.stringify(detail);
              }
            } else if (error.message) {
              errorMessage = error.message;
            }

            set({
              linkpreviewTestResult: {
                success: false,
                error: errorMessage
              },
              isTesting: false
            });
          }
        },

      testRSSFeed: async (id: string) => {
        const { rssFeeds } = get();
        const feed = rssFeeds[id];

        if (!feed) {
          return;
        }

        set({ isTesting: true, error: null });

        try {
          const response = await apiMethods.setup.testRSS(feed);
          set(state => ({
            rssTestResults: {
              ...state.rssTestResults,
              [id]: response.data
            },
            isTesting: false
          }));
        } catch (error: any) {
          set(state => ({
            rssTestResults: {
              ...state.rssTestResults,
              [id]: {
                success: false,
                error: error.response?.data?.detail || 'RSS feed test failed'
              }
            },
            isTesting: false
          }));
        }
      },

      validateConfiguration: async () => {
        const { emailConfig, apiKeysConfig, rssFeeds, processingConfig, obsidianConfig } = get();

        const completeConfig: CompleteSetupConfig = {
          email: emailConfig,
          api_keys: apiKeysConfig,
          rss_feeds: rssFeeds,
          processing: processingConfig,
          system: {
            enabled: obsidianConfig.enabled,
            obsidian_vault_path: obsidianConfig.obsidian_vault_path,
            obsidian_summaries_folder: obsidianConfig.obsidian_summaries_folder
          }
        };

        try {
          const response = await apiMethods.setup.validate(completeConfig);
          const validation = response.data;

          if (!validation.valid) {
            set({
              error: `Configuration invalid: ${Object.values(validation.errors).join(', ')}`
            });
          }

          return validation.valid;
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Validation failed'
          });
          return false;
        }
      },

      completeSetup: async () => {
        const { emailConfig, apiKeysConfig, rssFeeds, processingConfig, obsidianConfig } = get();

        set({ isLoading: true, error: null });

        const completeConfig: CompleteSetupConfig = {
          email: emailConfig,
          api_keys: apiKeysConfig,
          rss_feeds: rssFeeds,
          processing: processingConfig,
          system: {
            enabled: obsidianConfig.enabled,
            obsidian_vault_path: obsidianConfig.obsidian_vault_path,
            obsidian_summaries_folder: obsidianConfig.obsidian_summaries_folder
          }
        };

        try {
          console.log('Completing setup with obsidian config:', completeConfig);
          await apiMethods.settings.saveSettings(completeConfig);

          // Update configuration status - this will trigger redirect in App.tsx
          set({
            isConfigured: true,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Setup completion failed',
            isLoading: false
          });
          throw error;
        }
      },

      reset: () => {
        set({
          currentStep: 0,
          emailConfig: defaultEmailConfig,
          apiKeysConfig: defaultAPIKeysConfig,
          rssFeeds: defaultRSSFeeds,
          processingConfig: defaultProcessingConfig,
          obsidianConfig: defaultObsidianConfig, // ADD THIS LINE
          emailTestResult: null,
          claudeTestResult: null,
          linkpreviewTestResult: null,
          rssTestResults: {},
          isLoading: false,
          isTesting: false,
          error: null,
          isConfigured: false
        });
      }
    }),
    { name: 'setup-store' }
  )
);
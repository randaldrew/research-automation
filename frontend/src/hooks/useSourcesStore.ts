// frontend/src/hooks/useSourcesStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '../utils/api';

// Types
export interface SourceConfig {
  source_id: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  plugin_available: boolean;
  last_tested?: string;
  test_status?: boolean;
}

export interface PluginMetadata {
  plugin_type: string;
  name: string;
  description: string;
  config_schema: Record<string, any>;
  examples: Record<string, any>;
}

export interface CreateSourceRequest {
  source_id: string;
  source_type: string;
  name: string;
  enabled?: boolean;
  config: Record<string, any>;
}

export interface UpdateSourceRequest {
  name?: string;
  enabled?: boolean;
  config?: Record<string, any>;
}

export interface TestConfigRequest {
  source_type: string;
  config: Record<string, any>;
}

interface SourcesState {
  // Data
  sources: Record<string, SourceConfig>;
  availablePlugins: PluginMetadata[];
  selectedSource: string | null;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isCreating: boolean;
  error: string | null;
  
  // Test Results
  testResults: Record<string, any>;
  
  // Actions
  loadSources: () => Promise<void>;
  loadAvailablePlugins: () => Promise<void>;
  createSource: (request: CreateSourceRequest) => Promise<boolean>;
  updateSource: (sourceId: string, request: UpdateSourceRequest) => Promise<boolean>;
  deleteSource: (sourceId: string) => Promise<boolean>;
  testSource: (sourceId: string) => Promise<any>;
  testSourceConfig: (request: TestConfigRequest) => Promise<any>;
  enableSource: (sourceId: string) => Promise<boolean>;
  disableSource: (sourceId: string) => Promise<boolean>;
  
  // UI Actions
  setSelectedSource: (sourceId: string | null) => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export const useSourcesStore = create<SourcesState>()(
  devtools(
    (set, get) => ({
      // Initial state
      sources: {},
      availablePlugins: [],
      selectedSource: null,
      isLoading: false,
      isSaving: false,
      isTesting: false,
      isCreating: false,
      error: null,
      testResults: {},

      // Load all sources
      loadSources: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.sources.getAllSources();
          set({
            sources: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to load sources';
          set({
            error: errorMessage,
            isLoading: false,
          });
          console.error('Failed to load sources:', error);
        }
      },

      // Load available plugin types
      loadAvailablePlugins: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.sources.getAvailableTypes();
          set({
            availablePlugins: response.data,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to load available plugins';
          set({
            error: errorMessage,
            isLoading: false,
          });
          console.error('Failed to load available plugins:', error);
        }
      },

      // Create a new source
      createSource: async (request: CreateSourceRequest) => {
        set({ isCreating: true, error: null });

        try {
          const response = await apiMethods.sources.createSource(request);

          if (response.data.success) {
            // Reload sources to get the updated list
            await get().loadSources();
            set({ isCreating: false });
            return true;
          } else {
            set({
              error: response.data.message || 'Failed to create source',
              isCreating: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to create source';
          set({
            error: errorMessage,
            isCreating: false,
          });
          console.error('Failed to create source:', error);
          return false;
        }
      },

      // Update an existing source
      updateSource: async (sourceId: string, request: UpdateSourceRequest) => {
        set({ isSaving: true, error: null });

        try {
          const response = await apiMethods.sources.updateSource(sourceId, request);

          if (response.data.success) {
            // Reload sources to get the updated data
            await get().loadSources();
            set({ isSaving: false });
            return true;
          } else {
            set({
              error: response.data.message || 'Failed to update source',
              isSaving: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to update source';
          set({
            error: errorMessage,
            isSaving: false,
          });
          console.error('Failed to update source:', error);
          return false;
        }
      },

      // Delete a source
      deleteSource: async (sourceId: string) => {
        set({ isSaving: true, error: null });

        try {
          const response = await apiMethods.sources.deleteSource(sourceId);

          if (response.data.success) {
            // Remove from local state and clear selection if needed
            const currentSources = get().sources;
            const updatedSources = { ...currentSources };
            delete updatedSources[sourceId];

            const selectedSource = get().selectedSource;

            set({
              sources: updatedSources,
              selectedSource: selectedSource === sourceId ? null : selectedSource,
              isSaving: false,
            });
            return true;
          } else {
            set({
              error: response.data.message || 'Failed to delete source',
              isSaving: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to delete source';
          set({
            error: errorMessage,
            isSaving: false,
          });
          console.error('Failed to delete source:', error);
          return false;
        }
      },

      // Test a configured source
      testSource: async (sourceId: string) => {
        set({ isTesting: true, error: null });

        try {
          const response = await apiMethods.sources.testSource(sourceId);

          // Update test results
          const currentTestResults = get().testResults;
          set({
            testResults: {
              ...currentTestResults,
              [sourceId]: response.data,
            },
            isTesting: false,
          });

          return response.data;
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to test source';
          set({
            error: errorMessage,
            isTesting: false,
          });
          console.error('Failed to test source:', error);
          return { success: false, error: errorMessage };
        }
      },

      // Test source configuration before saving
      testSourceConfig: async (request: TestConfigRequest) => {
        set({ isTesting: true, error: null });

        try {
          const response = await apiMethods.sources.testConfig(request);
          set({ isTesting: false });
          return response.data;
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to test configuration';
          set({
            error: errorMessage,
            isTesting: false,
          });
          console.error('Failed to test configuration:', error);
          return { success: false, error: errorMessage };
        }
      },

      // Enable a source
      enableSource: async (sourceId: string) => {
        set({ isSaving: true, error: null });

        try {
          const response = await apiMethods.sources.enableSource(sourceId);

          if (response.data.success) {
            // Update local state
            const currentSources = get().sources;
            const updatedSources = {
              ...currentSources,
              [sourceId]: {
                ...currentSources[sourceId],
                enabled: true,
              },
            };

            set({
              sources: updatedSources,
              isSaving: false,
            });
            return true;
          } else {
            set({
              error: response.data.message || 'Failed to enable source',
              isSaving: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to enable source';
          set({
            error: errorMessage,
            isSaving: false,
          });
          console.error('Failed to enable source:', error);
          return false;
        }
      },

      // Disable a source
      disableSource: async (sourceId: string) => {
        set({ isSaving: true, error: null });

        try {
          const response = await apiMethods.sources.disableSource(sourceId);
          
          if (response.data.success) {
            // Update local state
            const currentSources = get().sources;
            const updatedSources = {
              ...currentSources,
              [sourceId]: {
                ...currentSources[sourceId],
                enabled: false,
              },
            };
            
            set({
              sources: updatedSources,
              isSaving: false,
            });
            return true;
          } else {
            set({
              error: response.data.message || 'Failed to disable source',
              isSaving: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Failed to disable source';
          set({
            error: errorMessage,
            isSaving: false,
          });
          console.error('Failed to disable source:', error);
          return false;
        }
      },

      // Set selected source
      setSelectedSource: (sourceId: string | null) => {
        set({ selectedSource: sourceId });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh all data
      refresh: async () => {
        const { loadSources, loadAvailablePlugins } = get();
        await Promise.all([
          loadSources(),
          loadAvailablePlugins(),
        ]);
      },
    }),
    {
      name: 'sources-store',
    }
  )
);
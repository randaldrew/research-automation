// frontend/src/hooks/useProcessingStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '@/utils/api.tsx';
import { WebSocketMessage } from './useWebSocket';

export interface ProcessingLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  step?: string;
  progress?: number;
  [key: string]: any;
}

export interface ProcessingResults {
  content_fetched?: number;
  summaries_generated?: number;
  insights_extracted?: number;
  links_processed?: number;
  exports_generated?: number;
}

export interface ProcessingState {
  status: 'idle' | 'running' | 'completed' | 'error';
  current_step: string;
  progress: number;
  total_steps: number;
  start_time: string | null;
  end_time: string | null;
  error_message: string | null;
  results: ProcessingResults;
  logs: ProcessingLogEntry[];
}

export interface ProcessingStats {
  total_summaries: number;
  summaries_last_week: number;
  total_links: number;
  total_insights: number;
  last_run: string | null;
  api_calls_today: number;
}

interface ProcessingStoreState {
  // Current processing state
  processingState: ProcessingState;

  // Statistics
  stats: ProcessingStats | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // WebSocket integration
  isWebSocketConnected: boolean;

  // Actions
  loadProcessingStatus: () => Promise<void>;
  loadStatistics: () => Promise<void>;
  startProcessing: (options?: { force_reprocess?: boolean; max_items?: number }) => Promise<void>;
  stopProcessing: () => Promise<void>;

  // WebSocket message handling
  handleWebSocketMessage: (message: WebSocketMessage) => void;
  setWebSocketConnected: (connected: boolean) => void;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// Default processing state
const defaultProcessingState: ProcessingState = {
  status: 'idle',
  current_step: '',
  progress: 0,
  total_steps: 0,
  start_time: null,
  end_time: null,
  error_message: null,
  results: {},
  logs: []
};

export const useProcessingStore = create<ProcessingStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      processingState: defaultProcessingState,
      stats: null,
      isLoading: false,
      error: null,
      isWebSocketConnected: false,

      // Load current processing status
      loadProcessingStatus: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiMethods.processing.getStatus();
          const status = response.data;

          set({
            processingState: {
              ...defaultProcessingState,
              ...status
            },
            isLoading: false
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load processing status',
            isLoading: false
          });
        }
      },

      // Load statistics
      loadStatistics: async () => {
          try {
            const response = await apiMethods.data.getStatistics(); // ✅ Use apiMethods
            const stats = response.data;

            set({
              stats: {
                total_summaries: stats.database?.summaries_count || 0,
                summaries_last_week: stats.database?.summaries_last_week || 0,
                total_links: stats.database?.links_count || 0,
                total_insights: stats.database?.insights_count || 0,
                last_run: stats.processing?.last_run || null,
                api_calls_today: 0
              }
            });
          } catch (error: any) {
            console.error('Failed to load statistics:', error);
          }
        },

      // Start processing
      startProcessing: async (options = {}) => {
          set({ isLoading: true, error: null });
          try {
            await apiMethods.processing.start(options);

            set(state => ({
              processingState: {
                ...state.processingState,
                status: 'running',
                start_time: new Date().toISOString(),
                end_time: null,
                error_message: null,
                progress: 0,
                current_step: 'Starting...',
                logs: []
              },
              isLoading: false
            }));
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to start processing',
              isLoading: false
            });
            throw error;
          }
        },

        stopProcessing: async () => {
          set({ isLoading: true, error: null });
          try {
            await apiMethods.processing.stop();
            set({ isLoading: false });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to stop processing',
              isLoading: false
            });
            throw error;
          }
        },

      // Handle WebSocket messages
      handleWebSocketMessage: (message: WebSocketMessage) => {
        const { type, data } = message;

        switch (type) {
          case 'status_update':
          case 'processing_update':
            if (data) {
              set(state => ({
                processingState: {
                  ...state.processingState,
                  ...data
                }
              }));
            }
            break;

          case 'processing_complete':
            if (data) {
              set(state => ({
                processingState: {
                  ...state.processingState,
                  ...data,
                  status: 'completed'
                }
              }));

              // Reload statistics after completion
              get().loadStatistics();
            }
            break;

          case 'processing_error':
            if (data) {
              set(state => ({
                processingState: {
                  ...state.processingState,
                  ...data.state,
                  status: 'error',
                  error_message: data.error
                },
                error: data.error
              }));
            }
            break;

          case 'pong':
            // Handle ping/pong for connection health
            break;

          default:
            console.log('Unknown WebSocket message type:', type);
        }
      },

      // Set WebSocket connection status
      setWebSocketConnected: (connected: boolean) => {
        set({ isWebSocketConnected: connected });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset state
      reset: () => {
        set({
          processingState: defaultProcessingState,
          stats: null,
          isLoading: false,
          error: null,
          isWebSocketConnected: false
        });
      }
    }),
    { name: 'processing-store' }
  )
);
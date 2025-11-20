// frontend/src/hooks/useSummariesStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods, apiUtils } from '@/utils/api';
import { SearchFilters } from '../components/common/SearchInput';

export interface Summary {
  id: number;
  title: string;
  source: string;
  source_type: string;
  date: string;
  summary: string;
  content_length: number;
  chunks_processed: number;
  created_at: string;
  read: boolean;
  starred: boolean;
  questions?: string[];
  tags?: string[];
  insights?: string[];
}

export interface SummariesFilters extends SearchFilters {
  source?: string;
  read?: boolean;
  starred?: boolean;
  sortBy?: 'date' | 'created_at' | 'title' | 'source';
  sortOrder?: 'asc' | 'desc';
}

interface SummariesState {
  // Data
  summaries: Summary[];
  totalCount: number;
  currentPage: number;
  pageSize: number;

  // Search and filters
  searchQuery: string;
  filters: SummariesFilters;

  // UI State
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  selectedSummaryId: number | null;

  // Actions
  loadSummaries: (page?: number, resetData?: boolean) => Promise<void>;
  searchSummaries: (query: string, filters?: SearchFilters) => Promise<void>;
  setFilters: (filters: Partial<SummariesFilters>) => void;
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Individual summary actions
  toggleRead: (summaryId: number) => Promise<void>;
  toggleStarred: (summaryId: number) => Promise<void>;
  selectSummary: (summaryId: number | null) => void;

  // Utility
  clearSearch: () => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const defaultFilters: SummariesFilters = {
  dateRange: 'all',
  contentType: 'summaries',
  tags: [],
  sortBy: 'date',
  sortOrder: 'desc'
};

export const useSummariesStore = create<SummariesState>()(
  devtools(
    (set, get) => ({
      // Initial state
      summaries: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 10,
      searchQuery: '',
      filters: defaultFilters,
      isLoading: false,
      isSearching: false,
      error: null,
      selectedSummaryId: null,

      // Load summaries with pagination
      loadSummaries: async (page = 1, resetData = false) => {
        const { pageSize, searchQuery } = get();

        set({
          isLoading: true,
          error: null,
          currentPage: page,
          ...(resetData && { summaries: [] })
        });

        try {
          let response;

          if (searchQuery.trim()) {
            // Use search endpoint if there's a query
            response = await apiMethods.data.search(
              searchQuery,
              'summaries',
              pageSize
            );

            const searchResult = apiUtils.handleSearchResponse(response);

            set({
              summaries: searchResult.results,
              totalCount: searchResult.total,
              isLoading: false,
              isSearching: false
            });
          } else {
              // Use regular summaries endpoint
              response = await apiMethods.data.getSummaries(
                pageSize,
                (page - 1) * pageSize
              );

              const paginatedResult = apiUtils.handlePaginatedResponse(response);

              set({
                summaries: paginatedResult.data,
                totalCount: paginatedResult.total,
                isLoading: false
              });
            }
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load summaries',
            isLoading: false,
            isSearching: false
          });
        }
      },

      // Search summaries
      searchSummaries: async (query: string, searchFilters?: SearchFilters) => {
        set({
          isSearching: true,
          error: null,
          searchQuery: query,
          currentPage: 1
        });

        // Update filters if provided
        if (searchFilters) {
          set(state => ({
            filters: { ...state.filters, ...searchFilters }
          }));
        }

        // Use the loadSummaries method which handles search
        await get().loadSummaries(1, true);
      },

      // Set filters
      setFilters: (newFilters: Partial<SummariesFilters>) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
          currentPage: 1
        }));

        // Reload with new filters
        get().loadSummaries(1, true);
      },

      // Set search query
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });

        if (query.trim()) {
          get().searchSummaries(query);
        } else {
          get().loadSummaries(1, true);
        }
      },

      // Set page
      setPage: (page: number) => {
        get().loadSummaries(page);
      },

      // Set page size
      setPageSize: (size: number) => {
        set({ pageSize: size, currentPage: 1 });
        get().loadSummaries(1, true);
      },

      // Toggle read status
      toggleRead: async (summaryId: number) => {
        const { summaries } = get();
        const summary = summaries.find(s => s.id === summaryId);
        if (!summary) return;

        // Optimistically update UI
        set(state => ({
          summaries: state.summaries.map(s =>
            s.id === summaryId ? { ...s, read: !s.read } : s
          )
        }));

        try {
          // TODO: Implement API call to update read status
          // await apiMethods.summaries.toggleRead(summaryId);
        } catch (error) {
          // Revert optimistic update on error
          set(state => ({
            summaries: state.summaries.map(s =>
              s.id === summaryId ? { ...s, read: !s.read } : s
            )
          }));
        }
      },

      // Toggle starred status
      toggleStarred: async (summaryId: number) => {
        const { summaries } = get();
        const summary = summaries.find(s => s.id === summaryId);
        if (!summary) return;

        // Optimistically update UI
        set(state => ({
          summaries: state.summaries.map(s =>
            s.id === summaryId ? { ...s, starred: !s.starred } : s
          )
        }));

        try {
          // TODO: Implement API call to update starred status
          // await apiMethods.summaries.toggleStarred(summaryId);
        } catch (error) {
          // Revert optimistic update on error
          set(state => ({
            summaries: state.summaries.map(s =>
              s.id === summaryId ? { ...s, starred: !s.starred } : s
            )
          }));
        }
      },

      // Select summary
      selectSummary: (summaryId: number | null) => {
        set({ selectedSummaryId: summaryId });
      },

      // Clear search
      clearSearch: () => {
        set({
          searchQuery: '',
          filters: defaultFilters,
          currentPage: 1
        });
        get().loadSummaries(1, true);
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh current view
      refresh: async () => {
        const { currentPage } = get();
        await get().loadSummaries(currentPage, false);
      }
    }),
    { name: 'summaries-store' }
  )
);
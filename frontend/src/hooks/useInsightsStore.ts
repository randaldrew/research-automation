// Create frontend/src/hooks/useInsightsStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '@/utils/api';

export interface Insight {
  id: number;
  summary_id?: number;
  source: string;
  topic: string;
  insight: string;
  tags: string[];
  date: string;
  created_at: string;
}

export interface InsightsFilters {
  source?: string;
  topic?: string;
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'year';
  date_from?: string;
  date_to?: string;
  sortBy?: 'date' | 'created_at' | 'source';
  sortOrder?: 'asc' | 'desc';
}

interface InsightsAnalytics {
  total_insights: number;
  top_sources: { source: string; count: number }[];
  top_topics: { topic: string; count: number }[];
  insights_by_date: { date: string; count: number }[];
  recent_insights: { id: number; source: string; insight: string; created_at: string }[];
}

interface InsightsState {
  // Data
  insights: Insight[];
  totalCount: number;
  currentPage: number;
  pageSize: number;

  // Search and filters
  searchQuery: string;
  filters: InsightsFilters;

  // UI State
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  selectedInsightId: number | null;

  // Analytics
  analytics: InsightsAnalytics | null;

  // Actions
  loadInsights: (page?: number, resetData?: boolean) => Promise<void>;
  searchInsights: (query: string, filters?: InsightsFilters) => Promise<void>;
  updateFilters: (filters: Partial<InsightsFilters>) => void;
  loadAnalytics: () => Promise<void>;
  selectInsight: (id: number | null) => void;
  clearSearch: () => void;
  setPageSize: (size: number) => void;
  refresh: () => Promise<void>;
}

export const useInsightsStore = create<InsightsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      insights: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      searchQuery: '',
      filters: {
        dateRange: 'all',
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      isLoading: false,
      isSearching: false,
      error: null,
      selectedInsightId: null,
      analytics: null,

      // Actions
      loadInsights: async (page = 1, resetData = false) => {
        const state = get();

        if (resetData) {
          set({ insights: [], currentPage: 1 });
        }

        set({ isLoading: true, error: null });

        try {
          const { filters, pageSize } = state;
          const offset = (page - 1) * pageSize;

          // Convert dateRange to specific dates if needed
          const apiFilters = { ...filters };
          if (filters.dateRange && filters.dateRange !== 'all') {
            const now = new Date();
            const dateRanges = {
              today: { from: new Date(now.setHours(0, 0, 0, 0)), to: new Date(now.setHours(23, 59, 59, 999)) },
              week: { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now },
              month: { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now },
              year: { from: new Date(now.getFullYear(), 0, 1), to: now }
            };

            const range = dateRanges[filters.dateRange as keyof typeof dateRanges];
            if (range) {
              apiFilters.date_from = range.from.toISOString().split('T')[0];
              apiFilters.date_to = range.to.toISOString().split('T')[0];
            }
          }

          const response = await apiMethods.insights.getAll({
            limit: pageSize,
            offset,
            ...apiFilters
          });

          const newInsights = page === 1 ? response.data.insights : [...state.insights, ...response.data.insights];

          set({
            insights: newInsights,
            totalCount: response.data.total,
            currentPage: page,
            isLoading: false
          });

        } catch (error) {
          console.error('Failed to load insights:', error);
          set({
            error: 'Failed to load insights. Please try again.',
            isLoading: false
          });
        }
      },

      searchInsights: async (query: string, filters?: InsightsFilters) => {
        set({
          isSearching: true,
          error: null,
          searchQuery: query,
          insights: [],
          currentPage: 1
        });

        if (filters) {
          set({ filters: { ...get().filters, ...filters } });
        }

        try {
          if (!query.trim()) {
            // If empty query, load regular insights
            await get().loadInsights(1, true);
            return;
          }

          const response = await apiMethods.insights.search(query, get().pageSize);

          set({
            insights: response.data.results,
            totalCount: response.data.total,
            isSearching: false
          });

        } catch (error) {
          console.error('Failed to search insights:', error);
          set({
            error: 'Failed to search insights. Please try again.',
            isSearching: false
          });
        }
      },

      updateFilters: (newFilters: Partial<InsightsFilters>) => {
        set({
          filters: { ...get().filters, ...newFilters },
          currentPage: 1
        });

        // Reload with new filters
        if (get().searchQuery) {
          get().searchInsights(get().searchQuery, newFilters);
        } else {
          get().loadInsights(1, true);
        }
      },

      loadAnalytics: async () => {
        try {
          const response = await apiMethods.insights.getAnalytics();
          set({ analytics: response.data });
        } catch (error) {
          console.error('Failed to load insights analytics:', error);
        }
      },

      selectInsight: (id: number | null) => {
        set({ selectedInsightId: id });
      },

      clearSearch: () => {
        set({
          searchQuery: '',
          insights: [],
          currentPage: 1
        });
        get().loadInsights(1, true);
      },

      setPageSize: (size: number) => {
        set({
          pageSize: size,
          currentPage: 1
        });
        get().loadInsights(1, true);
      },

      refresh: async () => {
        const { searchQuery } = get();
        if (searchQuery) {
          await get().searchInsights(searchQuery);
        } else {
          await get().loadInsights(1, true);
        }
        await get().loadAnalytics();
      }
    }),
    { name: 'insights-store' }
  )
);
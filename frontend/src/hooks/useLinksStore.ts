// frontend/src/hooks/useLinksStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiMethods } from '@/utils/api';
import { SearchFilters } from '../components/common/SearchInput';

export interface Link {
  id: number;
  url: string;
  title: string;
  description?: string;
  image_url?: string;
  source: string;
  date: string;
  tags?: string[];
  enriched: boolean;
  visited: boolean;
  created_at: string;
}

export interface LinksFilters extends SearchFilters {
  source?: string;
  enriched?: boolean;
  visited?: boolean;
  domain?: string;
  sortBy?: 'date' | 'created_at' | 'title' | 'source';
  sortOrder?: 'asc' | 'desc';
}

interface LinksState {
  // Data
  links: Link[];
  totalCount: number;
  currentPage: number;
  pageSize: number;

  // Search and filters
  searchQuery: string;
  filters: LinksFilters;

  // UI State
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  selectedLinkId: number | null;

  // Analytics
  domains: { domain: string; count: number }[];
  sources: { source: string; count: number }[];

  // Actions
  loadLinks: (page?: number, resetData?: boolean) => Promise<void>;
  searchLinks: (query: string, filters?: SearchFilters) => Promise<void>;
  setFilters: (filters: Partial<LinksFilters>) => void;
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Individual link actions
  markVisited: (linkId: number) => Promise<void>;
  selectLink: (linkId: number | null) => void;
  openLink: (link: Link) => void;

  // Analytics
  loadAnalytics: () => Promise<void>;

  // Utility
  clearSearch: () => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const defaultFilters: LinksFilters = {
  dateRange: 'all',
  contentType: 'links',
  tags: [],
  sortBy: 'date',
  sortOrder: 'desc'
};

export const useLinksStore = create<LinksState>()(
  devtools(
    (set, get) => ({
      // Initial state
      links: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20, // Show more links per page than summaries
      searchQuery: '',
      filters: defaultFilters,
      isLoading: false,
      isSearching: false,
      error: null,
      selectedLinkId: null,
      domains: [],
      sources: [],

      // Load links with pagination
      loadLinks: async (page = 1, resetData = false) => {
          const { pageSize, searchQuery, filters } = get();

          set({
            isLoading: true,
            error: null,
            currentPage: page,
            ...(resetData && { links: [] })
          });

          try {
            if (searchQuery.trim()) {
              // Use search endpoint if there's a query
              const response = await apiMethods.data.search(searchQuery, 'links', pageSize);

              set({
                links: response.data.links || response.data.results || response.data || [],
                totalCount: response.data.total || response.data?.length || 0,
                isLoading: false,
                isSearching: false
              });
            } else {
              // Use regular links endpoint
              const params = {
                page,
                limit: pageSize,
                source: filters.source,
                enriched: filters.enriched,
                visited: filters.visited
              };

              const response = await apiMethods.links.getAll(params);

              set({
                links: response.data.links || response.data.results || response.data || [],
                totalCount: response.data.total || 0,
                isLoading: false
              });
            }
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to load links',
              isLoading: false,
              isSearching: false
            });
          }
        },

      // Search links
      searchLinks: async (query: string) => {
          set({
            isSearching: true,
            searchQuery: query,
            currentPage: 1,
            error: null
          });

          try {
            const { pageSize } = get();
            const response = await apiMethods.data.search(query, 'links', pageSize);

            set({
              links: response.data.links || response.data.results || response.data || [],
              totalCount: response.data.total || response.data?.length || 0,
              isSearching: false
            });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Search failed',
              isSearching: false
            });
          }
        },

      // Set filters
      setFilters: (newFilters: Partial<LinksFilters>) => {
      // Check if contentType filter excludes 'links'
      if (newFilters.contentType && newFilters.contentType !== 'links' && newFilters.contentType !== 'all') {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
          links: [], // Clear links when not in content type
          totalCount: 0,
          currentPage: 1
        }));
        return;
      }

  set(state => ({
    filters: { ...state.filters, ...newFilters },
    currentPage: 1
  }));

  get().loadLinks(1, true);
},
      // Set search query
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });

        if (query.trim()) {
          get().searchLinks(query);
        } else {
          get().loadLinks(1, true);
        }
      },

      // Set page
      setPage: (page: number) => {
        get().loadLinks(page);
      },

      // Set page size
      setPageSize: (size: number) => {
        set({ pageSize: size, currentPage: 1 });
        get().loadLinks(1, true);
      },

      // Mark link as visited
      markVisited: async (linkId: number) => {
          // Optimistic update
          set(state => ({
            links: state.links.map(l =>
              l.id === linkId ? { ...l, visited: true } : l
            )
          }));

          try {
            await apiMethods.links.markVisited(linkId);
          } catch (error) {
            // Revert optimistic update on error
            set(state => ({
              links: state.links.map(l =>
                l.id === linkId ? { ...l, visited: false } : l
              )
            }));
            console.error('Failed to mark link as visited:', error);
          }
        },

      // Select link
      selectLink: (linkId: number | null) => {
        set({ selectedLinkId: linkId });
      },

      // Open link
      openLink: (link: Link) => {
        // Mark as visited
        get().markVisited(link.id);

        // Open in new tab
        window.open(link.url, '_blank', 'noopener,noreferrer');
      },

      // Load analytics data
      loadAnalytics: async () => {
          try {
            const response = await apiMethods.links.getAnalytics();

            set({
              domains: response.data.domains || [],
              sources: response.data.sources || []
            });
          } catch (error) {
            console.error('Failed to load analytics:', error);
            // Set empty arrays on error
            set({
              domains: [],
              sources: []
            });
          }
        },

      // Clear search
      clearSearch: () => {
        set({
          searchQuery: '',
          filters: defaultFilters,
          currentPage: 1
        });
        get().loadLinks(1, true);
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh current view
      refresh: async () => {
        const { currentPage } = get();
        await Promise.all([
          get().loadLinks(currentPage, false),
          get().loadAnalytics()
        ]);
      }
    }),
    { name: 'links-store' }
  )
);
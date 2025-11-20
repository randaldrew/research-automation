// frontend/src/components/pages/Links.tsx
import React, { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Select,
  Button,
  Badge,
  ActionIcon,
  Menu,
  Pagination,
  Alert,
  SimpleGrid,
  Collapse
} from '@mantine/core';
import {
  IconRefresh,
  IconSortAscending,
  IconSortDescending,
  IconEye,
  IconWorld,
  IconDownload,
  IconInfoCircle,
  IconChartBar,
  IconCalendar
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useLinksStore, Link } from '../../hooks/useLinksStore';
import { useProcessingStore } from '../../hooks/useProcessingStore';
import { SearchInput, SearchFilters } from '../common/SearchInput';
import { LinkCard } from '../links/LinkCard';
import { LinksAnalytics } from '../links/LinksAnalytics';
import { ContentSkeleton } from '../common/LoadingStates';
import {
  NoLinksState,
  NoSearchResultsState
} from '../common/EmptyStates';

export const Links: React.FC = () => {
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [showAnalytics, { toggle: toggleAnalytics }] = useDisclosure(false);

  const {
    links,
    totalCount,
    currentPage,
    pageSize,
    searchQuery,
    filters,
    isLoading,
    error,
    loadLinks,
    setFilters,
    setSearchQuery,
    setPage,
    setPageSize,
    markVisited,
    openLink,
    clearSearch,
    clearError,
    refresh,
    loadAnalytics
  } = useLinksStore();

  const { startProcessing } = useProcessingStore();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadLinks(1, true),
        loadAnalytics()
      ]);
    };

    loadData();
  }, [loadLinks, loadAnalytics]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleSortChange = (sortBy: 'date' | 'created_at' | 'title' | 'source') => {
    const newOrder = filters.sortBy === sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    setFilters({ sortBy, sortOrder: newOrder });
  };

  const handleStartProcessing = async () => {
    try {
      await startProcessing();
    } catch (error) {
      // Error handling is done in the processing store
    }
  };

  const handleDomainFilter = (domain: string) => {
    setFilters({ domain });
  };

  const handleSourceFilter = (source: string) => {
    setFilters({ source });
  };

  const handleBulkExport = () => {
    // ✅ Fixed TS7006: Explicit typing for link parameter
    const linksList = links.map((link: Link) => `- [${link.title}](${link.url})`).join('\n');
    const content = `# Extracted Links\n\n${linksList}\n\n---\nExported on ${new Date().toLocaleDateString()}`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `links-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderFilterBadges = () => {
    const badges = [];

    if (filters.visited !== undefined) {
      badges.push(
        <Badge key="visited" variant="light" color="blue">
          {filters.visited ? 'Visited' : 'Unvisited'}
        </Badge>
      );
    }

    if (filters.enriched !== undefined) {
      badges.push(
        <Badge key="enriched" variant="light" color="green">
          {filters.enriched ? 'Enhanced' : 'Basic'}
        </Badge>
      );
    }

    if (filters.source) {
      badges.push(
        <Badge key="source" variant="light" color="orange">
          {filters.source}
        </Badge>
      );
    }

    if (filters.domain) {
      badges.push(
        <Badge key="domain" variant="light" color="purple">
          {filters.domain}
        </Badge>
      );
    }

    return badges;
  };

  // Show loading state on first load
  if (isLoading && links.length === 0) {
    return (
      <Container size="xl" py="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <Title order={1}>Links Library</Title>
            <Text c="dimmed" size="lg">
              Intelligently extracted and enriched links from your content
            </Text>
          </div>
          <ContentSkeleton type="links" />
        </div>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <Group justify="space-between">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Title order={1}>Links Library</Title>
              {totalCount > 0 && (
                <Badge size="lg" variant="light" color="blue">
                  {totalCount} total
                </Badge>
              )}
            </div>
            <Text c="dimmed" size="lg">
              Intelligently extracted and enriched links from your content
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActionIcon
              variant="light"
              onClick={toggleAnalytics}
              title="Toggle analytics"
              color={showAnalytics ? 'blue' : 'gray'}
            >
              <IconChartBar size="1rem" />
            </ActionIcon>

            <ActionIcon
              variant="light"
              onClick={refresh}
              loading={isLoading}
              title="Refresh links"
            >
              <IconRefresh size="1rem" />
            </ActionIcon>

            {/* Sort Menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="light" title="Sort options">
                  {filters.sortOrder === 'asc' ? <IconSortAscending size="1rem" /> : <IconSortDescending size="1rem" />}
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Sort by</Menu.Label>
                <Menu.Item
                  leftSection={<IconCalendar size="0.9rem" />}
                  onClick={() => handleSortChange('date')}
                >
                  Date Added
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEye size="0.9rem" />}
                  onClick={() => handleSortChange('title')}
                >
                  Title
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconWorld size="0.9rem" />}
                  onClick={() => handleSortChange('source')}
                >
                  Source
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Export Menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="light" title="Export options">
                  <IconDownload size="1rem" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Export Options</Menu.Label>
                <Menu.Item
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={handleBulkExport}
                >
                  Export as Markdown
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={() => {
                    const csv = links.map((l: Link) =>
                      `"${l.title}","${l.url}","${l.source}","${l.date}"`
                    ).join('\n');
                    const blob = new Blob([`Title,URL,Source,Date\n${csv}`], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'links.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export as CSV
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* View Mode & Page Size */}
            <Select
              data={[
                { value: 'cards', label: 'Cards' },
                { value: 'compact', label: 'Compact' }
              ]}
              value={viewMode}
              onChange={(value) => value && setViewMode(value as 'cards' | 'compact')}
              w={100}
              size="sm"
            />

            <Select
              data={['10', '20', '50', '100']}
              value={pageSize.toString()}
              onChange={(value) => value && setPageSize(parseInt(value))}
              w={80}
              size="sm"
            />
          </div>
        </Group>

        {/* Analytics */}
        <Collapse in={showAnalytics}>
          <LinksAnalytics
            onDomainFilter={handleDomainFilter}
            onSourceFilter={handleSourceFilter}
          />
        </Collapse>

        {/* Search and Controls */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              onFiltersChange={handleFiltersChange}
              filters={filters}
              placeholder="Search links by title, URL, or description..."
              showFilters={true}
              debounceMs={300}
            />
          </div>
        </div>

        {/* Active Filters */}
        {renderFilterBadges().length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text size="sm" c="dimmed">Active filters:</Text>
            <div style={{ display: 'flex', gap: '8px' }}>
              {renderFilterBadges()}
            </div>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setFilters({
                visited: undefined,
                enriched: undefined,
                source: undefined,
                domain: undefined
              })}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert
            icon={<IconInfoCircle size="1rem" />}
            title="Error loading links"
            color="red"
            variant="light"
            withCloseButton
            onClose={clearError}
          >
            {error}
          </Alert>
        )}

        {/* Content */}
        {links.length === 0 && !isLoading && (
          <div>
            {searchQuery ? (
              <NoSearchResultsState
                searchTerm={searchQuery}
                onClearSearch={clearSearch}
              />
            ) : (
              <NoLinksState onStartProcessing={handleStartProcessing} />
            )}
          </div>
        )}

        {/* Links Grid */}
        {links.length > 0 && (
          <SimpleGrid
            cols={{
              base: 1,
              sm: viewMode === 'compact' ? 1 : 2,
              lg: viewMode === 'compact' ? 1 : 3
            }}
            spacing="md"
          >
            {/* ✅ Fixed TS7006: Explicit typing for link parameter */}
            {links.map((link: Link) => (
              <LinkCard
                key={link.id}
                link={link}
                onVisit={openLink}
                onMarkVisited={markVisited}
                compact={viewMode === 'compact'}
                showSource={true}
              />
            ))}
          </SimpleGrid>
        )}

        {/* Loading More State */}
        {isLoading && links.length > 0 && (
          <ContentSkeleton type="links" />
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <Group justify="center" mt="xl">
            <Pagination
              value={currentPage}
              onChange={setPage}
              total={Math.ceil(totalCount / pageSize)}
              size="sm"
            />
          </Group>
        )}
      </div>
    </Container>
  );
};
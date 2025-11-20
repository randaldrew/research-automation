// frontend/src/components/pages/Summaries.tsx
import React, { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Select,
  Button,
  Badge,
  ActionIcon,
  Menu,
  Pagination,
  Alert
} from '@mantine/core';
import {
  IconRefresh,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconEye,
  IconEyeOff,
  IconStar,
  IconStarOff,
  IconInfoCircle,
  IconDownload,
  IconCalendarWeek,
} from '@tabler/icons-react';
import { useSummariesStore, Summary } from '../../hooks/useSummariesStore';
import { useProcessingStore } from '../../hooks/useProcessingStore';
import { SearchInput, SearchFilters } from '../common/SearchInput';
import { SummaryCard } from '../summaries/SummaryCard';
import { SummaryModal } from '../summaries/SummaryModal';
import { ContentSkeleton } from '../common/LoadingStates';
import {
  NoSummariesState,
  NoSearchResultsState
} from '../common/EmptyStates';

export const Summaries: React.FC = () => {
  const [selectedSummary, setSelectedSummary] = useState<number | null>(null);

  const {
    summaries,
    totalCount,
    currentPage,
    pageSize,
    searchQuery,
    filters,
    isLoading,
    error,
    loadSummaries,
    setFilters,
    setSearchQuery,
    setPage,
    setPageSize,
    toggleRead,
    toggleStarred,
    clearSearch,
    clearError,
    refresh,
  } = useSummariesStore();

  const { startProcessing } = useProcessingStore();

  // Load initial data
  useEffect(() => {
    loadSummaries(1, true);
  }, [loadSummaries]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleDownloadSummary = async (summaryId: number, filename: string) => {
      try {
          const response = await fetch(`/api/v1/summaries/${summaryId}/download`);
          if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
          } else {
              console.error('Download failed');
          }
      } catch (error) {
          console.error('Download error:', error);
      }
  };

  const handleGenerateWeeklySummary = async () => {
      try {
          const response = await fetch('/api/v1/processing/generate-weekly-summary', {
              method: 'POST'
          });
          if (response.ok) {
              await refresh();
          }
      } catch (error) {
          console.error('Failed to generate weekly summary:', error);
      }
  };

  const handleDownloadWeeklySummary = async () => {
      try {
          const response = await fetch('/api/v1/processing/generate-and-download-weekly-summary', {
              method: 'POST'
          });
          if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Weekly_Summary_${new Date().toISOString().split('T')[0]}.md`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
          }
      } catch (error) {
          console.error('Download error:', error);
      }
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

  const getSelectedSummary = () => {
    return summaries.find((s: Summary) => s.id === selectedSummary) || null;
  };

  const renderFilterBadges = () => {
    const badges = [];

    if (filters.read !== undefined) {
      badges.push(
        <Badge key="read" variant="light" color="blue">
          {filters.read ? 'Read Only' : 'Unread Only'}
        </Badge>
      );
    }

    if (filters.starred !== undefined) {
      badges.push(
        <Badge key="starred" variant="light" color="yellow">
          {filters.starred ? 'Starred Only' : 'Not Starred'}
        </Badge>
      );
    }

    if (filters.source) {
      badges.push(
        <Badge key="source" variant="light" color="green">
          Source: {filters.source}
        </Badge>
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => {
        badges.push(
          <Badge key={`tag-${tag}`} variant="light" color="purple">
            #{tag}
          </Badge>
        );
      });
    }

    return badges;
  };

  return (
    <Container size="xl" py="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div>
          <Title order={1} size="h1" fw={700} mb="sm">
            AI Summaries
          </Title>
          <Text size="lg" c="dimmed">
            AI-generated summaries of your processed content with insights and key takeaways.
          </Text>
        </div>

        <Group justify="space-between" mb="md">
            <Title order={2}>Content Summaries</Title>
            <Group>
                <Button
                    leftSection={<IconCalendarWeek size="1rem"/>}
                    variant="light"
                    onClick={handleGenerateWeeklySummary}
                >
                    Generate Weekly Summary
                </Button>
                <Button
                    leftSection={<IconDownload size="1rem"/>}
                    variant="outline"
                    onClick={handleDownloadWeeklySummary}
                >
                    Download Weekly Summary
                </Button>
                <Button
                    leftSection={<IconRefresh size="1rem"/>}
                    variant="outline"
                    onClick={() => refresh()}
                    loading={isLoading}
                >
                    Refresh
                </Button>
            </Group>
        </Group>

        {/* Controls Bar */}
        <Group justify="space-between" wrap="wrap">
          <Group gap="md">
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              onFiltersChange={handleFiltersChange}
              filters={{ ...filters, contentType: 'summaries' }}
              placeholder="Search summariems..."

            />

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  variant="light"
                  leftSection={<IconFilter size="1rem" />}
                  rightSection={
                    renderFilterBadges().length > 0 ? (
                      <Badge size="xs" variant="filled" color="blue">
                        {renderFilterBadges().length}
                      </Badge>
                    ) : null
                  }
                >
                  Filters
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Reading Status</Menu.Label>
                <Menu.Item
                  leftSection={<IconEye size="0.9rem" />}
                  onClick={() => setFilters({ read: undefined })}
                >
                  All Summaries
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEye size="0.9rem" />}
                  onClick={() => setFilters({ read: false })}
                >
                  Unread Only
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEyeOff size="0.9rem" />}
                  onClick={() => setFilters({ read: true })}
                >
                  Read Only
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label>Favorites</Menu.Label>
                <Menu.Item
                  leftSection={<IconStar size="0.9rem" />}
                  onClick={() => setFilters({ starred: true })}
                >
                  Starred Only
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconStarOff size="0.9rem" />}
                  onClick={() => setFilters({ starred: false })}
                >
                  Not Starred
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  variant="light"
                  leftSection={
                    filters.sortOrder === 'asc' ?
                      <IconSortAscending size="1rem" /> :
                      <IconSortDescending size="1rem" />
                  }
                >
                  Sort
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item onClick={() => handleSortChange('date')}>
                  By Date
                </Menu.Item>
                <Menu.Item onClick={() => handleSortChange('created_at')}>
                  By Created
                </Menu.Item>
                <Menu.Item onClick={() => handleSortChange('title')}>
                  By Title
                </Menu.Item>
                <Menu.Item onClick={() => handleSortChange('source')}>
                  By Source
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Group gap="sm">
            <ActionIcon
              variant="light"
              onClick={refresh}
              loading={isLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>

            <Select
              value={pageSize.toString()}
              onChange={(value) => value && setPageSize(parseInt(value))}
              data={['10', '25', '50', '100']}
              w={80}
            />
          </Group>
        </Group>

        {/* Active Filters */}
        {renderFilterBadges().length > 0 && (
          <Group gap="xs">
            <Text size="sm" fw={500}>Active filters:</Text>
            {renderFilterBadges()}
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setFilters({})}
            >
              Clear all
            </Button>
          </Group>
        )}

        {/* Error State */}
        {error && (
          <Alert
            icon={<IconInfoCircle size="1rem" />}
            title="Error Loading Summaries"
            color="red"
            variant="light"
            withCloseButton
            onClose={clearError}
          >
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && summaries.length === 0 && (
          <ContentSkeleton type="summaries" />
        )}

        {/* Empty States */}
        {!isLoading && summaries.length === 0 && !error && (
          <div>
            {searchQuery ? (
              <NoSearchResultsState
                searchTerm={searchQuery}
                onClearSearch={clearSearch}
              />
            ) : (
              <NoSummariesState onStartProcessing={handleStartProcessing} />
            )}
          </div>
        )}

        {/* Summaries Grid */}
        {summaries.length > 0 && (
          <Stack gap="md">
            {summaries.map((summary: Summary) => (
              <SummaryCard
                key={summary.id}
                summary={summary}
                onToggleRead={toggleRead}
                onToggleStarred={toggleStarred}
                onView={(summary) => setSelectedSummary(summary.id)}
                onDownload={handleDownloadSummary}
              />
            ))}
          </Stack>
        )}

        {/* Loading More State */}
        {isLoading && summaries.length > 0 && (
          <ContentSkeleton type="summaries" />
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

        {/* Summary Modal */}
        <SummaryModal
          summary={getSelectedSummary()}
          opened={selectedSummary !== null}
          onClose={() => setSelectedSummary(null)}
          onToggleRead={toggleRead}
          onToggleStarred={toggleStarred}
        />
      </div>
    </Container>
  );
};
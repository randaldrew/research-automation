// Create frontend/src/components/pages/Insights.tsx

import React, { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Badge,
  ActionIcon,
  Button,
  SimpleGrid,
  Alert,
  Pagination,
  Select,
  TextInput,
  Modal,
} from '@mantine/core';
import {
  IconBulb,
  IconSearch,
  IconRefresh,
  IconCalendar,
  IconTag,
  IconBuildingStore,
  IconInfoCircle,
  IconX
} from '@tabler/icons-react';
import { useInsightsStore } from '../../hooks/useInsightsStore';
import { LoadingOverlay } from '../common/LoadingStates';

interface InsightData {
  id: number;
  summary_id?: number;
  source: string;
  topic: string;
  insight: string;
  tags: string[];
  date: string;
  created_at: string;
}

interface InsightCardProps {
  insight: InsightData;
  onClick?: () => void;
  compact?: boolean;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onClick, compact = false }) => {
  if (compact) {
    return (
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        withBorder
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" mb="xs">
              <IconBulb size="0.9rem" color="orange" />
              <Text size="sm" fw={500} c="dimmed">{insight.source}</Text>
              <Text size="xs" c="dimmed">
                {new Date(insight.created_at).toLocaleDateString()}
              </Text>
            </Group>

            <Text size="sm" style={{ lineHeight: 1.4 }} lineClamp={2}>
              {insight.insight}
            </Text>

            <Group gap="xs" mt="xs" justify="space-between">
              {insight.topic && (
                <Badge variant="light" color="blue" size="xs">
                  {insight.topic}
                </Badge>
              )}

              {insight.tags && insight.tags.length > 0 && (
                <Group gap="xs">
                  {insight.tags.slice(0, 2).map((tag: string) => (
                    <Badge key={tag} size="xs" variant="dot" color="gray">
                      {tag}
                    </Badge>
                  ))}
                  {insight.tags.length > 2 && (
                    <Badge size="xs" variant="light" color="gray">
                      +{insight.tags.length - 2}
                    </Badge>
                  )}
                </Group>
              )}
            </Group>
          </div>
        </Group>
      </Card>
    );
  }

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <IconBulb size="1rem" color="orange" />
            <Text size="sm" fw={500} c="dimmed">{insight.source}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            {new Date(insight.created_at).toLocaleDateString()}
          </Text>
        </Group>

        {/* Insight Content */}
        <Text size="sm" style={{ lineHeight: 1.5 }}>
          {insight.insight}
        </Text>

        {/* Topic and Tags */}
        <Group justify="space-between">
          {insight.topic && (
            <Badge variant="light" color="blue" size="sm">
              {insight.topic}
            </Badge>
          )}

          {insight.tags && insight.tags.length > 0 && (
            <Group gap="xs">
              {insight.tags.slice(0, 2).map((tag: string) => (
                <Badge key={tag} size="xs" variant="dot" color="gray">
                  {tag}
                </Badge>
              ))}
              {insight.tags.length > 2 && (
                <Badge size="xs" variant="light" color="gray">
                  +{insight.tags.length - 2}
                </Badge>
              )}
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  );
};

const InsightDetailModal: React.FC<{
  insight: InsightData | null;
  opened: boolean;
  onClose: () => void;
}> = ({ insight, opened, onClose }) => {
  if (!insight) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconBulb size="1.2rem" color="orange" />
          <div>
            <Text fw={600}>Key Insight</Text>
            <Text size="xs" c="dimmed">{insight.source}</Text>
          </div>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" style={{ lineHeight: 1.6 }}>
          {insight.insight}
        </Text>

        {insight.topic && (
          <Group gap="xs">
            <Text size="sm" fw={500}>Topic:</Text>
            <Badge variant="light" color="blue">{insight.topic}</Badge>
          </Group>
        )}

        {insight.tags && insight.tags.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">Tags:</Text>
            <Group gap="xs">
              {insight.tags.map((tag: string) => (
                <Badge key={tag} size="sm" variant="dot" color="gray">
                  {tag}
                </Badge>
              ))}
            </Group>
          </div>
        )}

        <Group gap="md" style={{ fontSize: '12px', color: 'var(--mantine-color-dimmed)' }}>
          <Text size="xs">
            <strong>Date:</strong> {new Date(insight.date).toLocaleDateString()}
          </Text>
          <Text size="xs">
            <strong>Added:</strong> {new Date(insight.created_at).toLocaleDateString()}
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
};

export const Insights: React.FC = () => {
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<InsightData | null>(null);

  const {
    insights,
    totalCount,
    currentPage,
    pageSize,
    isLoading,
    error,
    searchQuery,
    filters,
    analytics,
    loadInsights,
    searchInsights,
    updateFilters,
    loadAnalytics,
    clearSearch,
    setPageSize,
    refresh
  } = useInsightsStore();

  useEffect(() => {
    loadInsights();
    loadAnalytics();
  }, []);

  const handleSearch = (query: string) => {
    searchInsights(query);
  };

  const handleInsightClick = (insight: InsightData) => {
    setSelectedInsight(insight);
    setDetailModalOpened(true);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.source) count++;
    if (filters.topic) count++;
    if (filters.dateRange && filters.dateRange !== 'all') count++;
    return count;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Container size="xl" py="md">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={1}>Insights</Title>
              <Text c="dimmed" size="lg">
                Key insights extracted from your content ({totalCount} total)
              </Text>
            </div>

            <Group gap="xs">
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

              <ActionIcon
                variant="light"
                onClick={refresh}
                loading={isLoading}
                title="Refresh insights"
              >
                <IconRefresh size="1rem" />
              </ActionIcon>
            </Group>
          </Group>

          {/* Search */}
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="md">
              <TextInput
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                leftSection={<IconSearch size="1rem" />}
                rightSection={
                  searchQuery && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={clearSearch}
                    >
                      <IconX size="1rem" />
                    </ActionIcon>
                  )
                }
              />

              {/* Active Filters */}
              {getActiveFiltersCount() > 0 && (
                <Group gap="xs">
                  <Text size="sm" fw={500}>Active filters:</Text>

                  {filters.dateRange && filters.dateRange !== 'all' && (
                    <Badge
                      size="sm"
                      variant="light"
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => updateFilters({ dateRange: 'all' })}
                        >
                          <IconX size="0.6rem" />
                        </ActionIcon>
                      }
                    >
                      {filters.dateRange === 'today' ? 'Today' : `This ${filters.dateRange}`}
                    </Badge>
                  )}

                  {filters.source && (
                    <Badge
                      size="sm"
                      variant="light"
                      leftSection={<IconBuildingStore size="0.8rem" />}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => updateFilters({ source: undefined })}
                        >
                          <IconX size="0.6rem" />
                        </ActionIcon>
                      }
                    >
                      {filters.source}
                    </Badge>
                  )}

                  {filters.topic && (
                    <Badge
                      size="sm"
                      variant="light"
                      leftSection={<IconTag size="0.8rem" />}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => updateFilters({ topic: undefined })}
                        >
                          <IconX size="0.6rem" />
                        </ActionIcon>
                      }
                    >
                      Topic: {filters.topic}
                    </Badge>
                  )}
                </Group>
              )}
            </Stack>
          </Card>

          {/* Analytics Cards */}
          {analytics && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">Total Insights</Text>
                    <Text size="xl" fw={700}>{analytics.total_insights}</Text>
                  </div>
                  <IconBulb size="1.5rem" color="orange" opacity={0.6} />
                </Group>
              </Card>

              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">Top Source</Text>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {analytics.top_sources[0]?.source || 'None'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {analytics.top_sources[0]?.count || 0} insights
                    </Text>
                  </div>
                  <IconBuildingStore size="1.5rem" color="blue" opacity={0.6} />
                </Group>
              </Card>

              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">Top Topic</Text>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {analytics.top_topics[0]?.topic || 'None'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {analytics.top_topics[0]?.count || 0} insights
                    </Text>
                  </div>
                  <IconTag size="1.5rem" color="green" opacity={0.6} />
                </Group>
              </Card>

              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">Recent</Text>
                    <Text size="sm" fw={500}>
                      {analytics.insights_by_date.slice(0, 7).reduce((sum, day) => sum + day.count, 0)}
                    </Text>
                    <Text size="xs" c="dimmed">Last 7 days</Text>
                  </div>
                  <IconCalendar size="1.5rem" color="purple" opacity={0.6} />
                </Group>
              </Card>
            </SimpleGrid>
          )}

          {/* Error State */}
          {error && (
            <Alert icon={<IconInfoCircle size="1rem" />} color="red" variant="light">
              {error}
            </Alert>
          )}

          {/* Results Count and Page Size */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {insights.length} of {totalCount} insights
            </Text>

            <Group gap="xs">
              <Text size="sm">Page size:</Text>
              <Select
                size="xs"
                data={['10', '20', '50']}
                value={pageSize.toString()}
                onChange={(value) => setPageSize(parseInt(value || '20'))}
                style={{ width: 70 }}
              />
            </Group>
          </Group>

          {/* Insights Grid */}
          <div style={{ position: 'relative', minHeight: '200px' }}>
            <LoadingOverlay visible={isLoading} />

            {insights.length === 0 && !isLoading ? (
              <Card shadow="sm" padding="xl" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <IconBulb size="3rem" color="gray" opacity={0.5} />
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={500} mb="xs">
                      {searchQuery ? 'No matching insights found' : 'No insights available'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {searchQuery
                        ? 'Try adjusting your search terms or filters'
                        : 'Process some content to start extracting insights'
                      }
                    </Text>
                  </div>
                  {searchQuery && (
                    <Button variant="light" onClick={clearSearch}>
                      Clear Search
                    </Button>
                  )}
                </Stack>
              </Card>
            ) : (
              <SimpleGrid
                cols={{
                  base: 1,
                  sm: viewMode === 'compact' ? 1 : 2,
                  lg: viewMode === 'compact' ? 1 : 3
                }}
                spacing="md"
              >
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onClick={() => handleInsightClick(insight)}
                    compact={viewMode === 'compact'}
                  />
                ))}
              </SimpleGrid>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center">
              <Pagination
                value={currentPage}
                onChange={(page) => loadInsights(page)}
                total={totalPages}
                size="sm"
              />
            </Group>
          )}
        </Stack>
      </Container>

      {/* Detail Modal */}
      <InsightDetailModal
        insight={selectedInsight}
        opened={detailModalOpened}
        onClose={() => {
          setDetailModalOpened(false);
          setSelectedInsight(null);
        }}
      />
    </>
  );
};
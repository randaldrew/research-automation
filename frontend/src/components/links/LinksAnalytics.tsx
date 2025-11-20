// frontend/src/components/links/LinksAnalytics.tsx
import React from 'react';
import {
  Card,
  Group,
  Text,
  Badge,
  Stack,
  Progress,
  SimpleGrid,
  ScrollArea,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconWorld,
  IconTrendingUp,
  IconEye,
  IconLink,
  IconCalendar,
  IconFilter
} from '@tabler/icons-react';
import { useLinksStore } from '../../hooks/useLinksStore';

interface LinksAnalyticsProps {
  onDomainFilter?: (domain: string) => void;
  onSourceFilter?: (source: string) => void;
}

export const LinksAnalytics: React.FC<LinksAnalyticsProps> = ({
  onDomainFilter,
  onSourceFilter
}) => {
  const { links } = useLinksStore();

  // Calculate analytics from current links
  const analytics = React.useMemo(() => {
    // SAFETY CHECK: Ensure links is an array
    const safeLinks = Array.isArray(links) ? links : [];

    const totalLinks = safeLinks.length;
    const visitedLinks = safeLinks.filter(l => l?.visited).length;
    const enrichedLinks = safeLinks.filter(l => l?.enriched).length;

    const uniqueDomains = new Set(safeLinks.map(l => {
      try {
        return new URL(l?.url || '').hostname.replace('www.', '');
      } catch {
        return 'unknown';
      }
    })).size;

    const domainCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    safeLinks.forEach(link => {
      if (!link) return; // Additional safety check

      // Count domains
      try {
        const domain = new URL(link.url).hostname.replace('www.', '');
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch {
        domainCounts['unknown'] = (domainCounts['unknown'] || 0) + 1;
      }

      // Count sources
      if (link.source) {
        sourceCounts[link.source] = (sourceCounts[link.source] || 0) + 1;
      }
    });

    const topDomains = Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([domain, count]) => ({ domain, count }));

    const topSources = Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([source, count]) => ({ source, count }));

    return {
      totalLinks,
      visitedLinks,
      enrichedLinks,
      uniqueDomains,
      visitedPercentage: totalLinks > 0 ? (visitedLinks / totalLinks) * 100 : 0,
      enrichedPercentage: totalLinks > 0 ? (enrichedLinks / totalLinks) * 100 : 0,
      topDomains,
      topSources
    };
  }, [links]);

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    description?: string;
    progress?: number;
  }> = ({ title, value, icon, color, description, progress }) => (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={600} c="dimmed">{title}</Text>
        <Badge size="sm" color={color} variant="light">
          {icon}
        </Badge>
      </Group>

      <Text size="xl" fw={700} mb="xs">
        {value}
      </Text>

      {description && (
        <Text size="xs" c="dimmed" mb="xs">
          {description}
        </Text>
      )}

      {progress !== undefined && (
        <Progress value={progress} color={color} size="sm" />
      )}
    </Card>
  );

  return (
    <Stack>
      {/* Overview Stats */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <StatCard
          title="Total Links"
          value={analytics.totalLinks}
          icon={<IconLink size="1rem" />}
          color="blue"
          description={`${analytics.uniqueDomains} unique domains`}
        />

        <StatCard
          title="Visited"
          value={`${Math.round(analytics.visitedPercentage)}%`}
          icon={<IconEye size="1rem" />}
          color="green"
          description={`${analytics.visitedLinks} of ${analytics.totalLinks}`}
          progress={analytics.visitedPercentage}
        />

        <StatCard
          title="Enriched"
          value={`${Math.round(analytics.enrichedPercentage)}%`}
          icon={<IconTrendingUp size="1rem" />}
          color="orange"
          description={`${analytics.enrichedLinks} enhanced`}
          progress={analytics.enrichedPercentage}
        />

        <StatCard
          title="Domains"
          value={analytics.uniqueDomains}
          icon={<IconWorld size="1rem" />}
          color="purple"
          description="Unique sources"
        />
      </SimpleGrid>

      {/* Top Domains and Sources */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Top Domains */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600}>Top Domains</Text>
            <Badge size="sm" variant="light" color="blue">
              {analytics.topDomains.length} domains
            </Badge>
          </Group>

          <ScrollArea h={200}>
            <Stack>
              {analytics.topDomains.map(({ domain, count }) => (
                <Group key={domain} justify="space-between">
                  <Group style={{ flex: 1, minWidth: 0 }}>
                    <IconWorld size="0.8rem" color="var(--mantine-color-dimmed)" />
                    <Text
                      size="sm"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {domain}
                    </Text>
                  </Group>

                  <Group>
                    <Badge size="xs" variant="light">
                      {count}
                    </Badge>
                    {onDomainFilter && (
                      <Tooltip label={`Filter by ${domain}`}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => onDomainFilter(domain)}
                        >
                          <IconFilter size="0.7rem" />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}

              {analytics.topDomains.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No domains to show
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Card>

        {/* Top Sources */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600}>Top Sources</Text>
            <Badge size="sm" variant="light" color="green">
              {analytics.topSources.length} sources
            </Badge>
          </Group>

          <ScrollArea h={200}>
            <Stack>
              {analytics.topSources.map(({ source, count }) => (
                <Group key={source} justify="space-between">
                  <Group style={{ flex: 1, minWidth: 0 }}>
                    <IconCalendar size="0.8rem" color="var(--mantine-color-dimmed)" />
                    <Text
                      size="sm"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {source}
                    </Text>
                  </Group>

                  <Group>
                    <Badge size="xs" variant="light">
                      {count}
                    </Badge>
                    {onSourceFilter && (
                      <Tooltip label={`Filter by ${source}`}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => onSourceFilter(source)}
                        >
                          <IconFilter size="0.7rem" />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}

              {analytics.topSources.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No sources to show
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Card>
      </SimpleGrid>
    </Stack>
  );
};
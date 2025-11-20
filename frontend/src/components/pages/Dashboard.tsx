// frontend/src/components/pages/Dashboard.tsx
import React, { useEffect } from 'react';
import {
  Container,
  Grid,
  Title,
  Text,
  Card,
  Group,
  Badge,
  SimpleGrid,
  Alert,
  Button,
  ActionIcon
} from '@mantine/core';
import {
  IconFileText,
  IconLink,
  IconBulb,
  IconTrendingUp,
  IconRefresh,
  IconInfoCircle,
  IconExternalLink
} from '@tabler/icons-react';
import { ProcessingStatusCard } from '../dashboard/ProcessingStatusCard';
import { useProcessingStore } from '../../hooks/useProcessingStore';

// Quick Stats Card Component
const StatsCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  description?: string;
}> = ({ title, value, icon, color, description }) => (
  <Card shadow="sm" padding="lg" radius="md" withBorder>
    <Group justify="space-between" mb="xs">
      <Text size="sm" c="dimmed" fw={500}>
        {title}
      </Text>
      <div style={{ color }}>{icon}</div>
    </Group>
    <Text size="xl" fw={700} mb="xs">
      {value.toLocaleString()}
    </Text>
    {description && (
      <Text size="xs" c="dimmed">
        {description}
      </Text>
    )}
  </Card>
);

// Recent Activity Component
const RecentActivity: React.FC = () => {
  const { processingState, stats } = useProcessingStore();

  const activities = [
    {
      action: 'Last Processing Run',
      time: stats?.last_run ? new Date(stats.last_run).toLocaleDateString() : 'Never',
      status: processingState.status
    },
    {
      action: 'Total Summaries Generated',
      time: `${stats?.total_summaries || 0} summaries`,
      status: 'info'
    },
    {
      action: 'Links Extracted',
      time: `${stats?.total_links || 0} links`,
      status: 'info'
    }
  ];

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Text size="lg" fw={600}>Recent Activity</Text>
        <ActionIcon variant="light" size="sm">
          <IconRefresh size="1rem" />
        </ActionIcon>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activities.map((activity, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text size="sm" fw={500}>{activity.action}</Text>
              <Text size="xs" c="dimmed">{activity.time}</Text>
            </div>
            {activity.status === 'running' && (
              <Badge color="blue" variant="light" size="sm">Active</Badge>
            )}
            {activity.status === 'completed' && (
              <Badge color="green" variant="light" size="sm">Complete</Badge>
            )}
            {activity.status === 'error' && (
              <Badge color="red" variant="light" size="sm">Error</Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

// Quick Actions Component
const QuickActions: React.FC = () => {
  const { startProcessing, processingState } = useProcessingStore();

  const handleStartProcessing = async () => {
    try {
      await startProcessing();
    } catch (error) {
      console.error('Failed to start processing:', error);
    }
  };

  const isProcessing = processingState.status === 'running';

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Text size="lg" fw={600} mb="md">Quick Actions</Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Button
          leftSection={<IconRefresh size="0.9rem" />}
          onClick={handleStartProcessing}
          loading={isProcessing}
          disabled={isProcessing}
          fullWidth
        >
          {isProcessing ? 'Processing...' : 'Start Processing'}
        </Button>

        <Button
          variant="light"
          leftSection={<IconFileText size="0.9rem" />}
          onClick={() => window.location.href = '/summaries'}
          fullWidth
        >
          View Summaries
        </Button>

        <Button
          variant="light"
          leftSection={<IconLink size="0.9rem" />}
          onClick={() => window.location.href = '/links'}
          fullWidth
        >
          Browse Links
        </Button>

        <Button
          variant="outline"
          leftSection={<IconExternalLink size="0.9rem" />}
          onClick={() => window.open('https://github.com/randaldrew/research-automation', '_blank')}
          fullWidth
        >
          View on GitHub
        </Button>
      </div>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const {
    processingState,
    stats,
    isWebSocketConnected,
    loadProcessingStatus,
    loadStatistics
  } = useProcessingStore();

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadProcessingStatus(),
        loadStatistics()
      ]);
    };

    loadData();
  }, [loadProcessingStatus, loadStatistics]);

  return (
    <Container size="xl" py="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div>
          <Title order={1}>Dashboard</Title>
          <Text c="dimmed" size="lg">
            Monitor your research automation system
          </Text>
        </div>

        {/* WebSocket Connection Alert */}
        {!isWebSocketConnected && (
          <Alert
            icon={<IconInfoCircle size="1rem" />}
            title="Real-time Updates Unavailable"
            color="yellow"
            variant="light"
          >
            WebSocket connection lost. Processing status updates may be delayed.
            You can still use the application normally,
            but you may need to refresh manually to see processing updates.
          </Alert>
        )}

        {/* Main Processing Status */}
        <ProcessingStatusCard />

        {/* Stats Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <StatsCard
            title="Total Summaries"
            value={stats?.total_summaries || 0}
            icon={<IconFileText size="1.5rem" />}
            color="blue"
            description="AI-generated summaries"
          />
          <StatsCard
            title="Extracted Links"
            value={stats?.total_links || 0}
            icon={<IconLink size="1.5rem" />}
            color="green"
            description="From all content sources"
          />
          <StatsCard
            title="Key Insights"
            value={stats?.total_insights || 0}
            icon={<IconBulb size="1.5rem" />}
            color="purple"
            description="Extracted insights"
          />
          <StatsCard
            title="This Week"
            value={stats?.summaries_last_week || 0}
            icon={<IconTrendingUp size="1.5rem" />}
            color="orange"
            description="New summaries created"
          />
        </SimpleGrid>

        {/* Content Grid */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <RecentActivity />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <QuickActions />
          </Grid.Col>
        </Grid>

        {/* System Status */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text size="lg" fw={600} mb="md">System Status</Text>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">Processing Engine</Text>
              <Badge color="green" variant="light" size="sm">Online</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">AI Service (Claude)</Text>
              <Badge color="green" variant="light" size="sm">Ready</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">Database</Text>
              <Badge color="green" variant="light" size="sm">Connected</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">Email Service</Text>
              <Badge color="green" variant="light" size="sm">Ready</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">Link Enrichment</Text>
              <Badge color="green" variant="light" size="sm">Ready</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">WebSocket Connection</Text>
              <Badge
                color={isWebSocketConnected ? 'green' : 'red'}
                variant="light"
                size="sm"
              >
                {isWebSocketConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </SimpleGrid>

          {processingState.status === 'error' && processingState.error_message && (
            <Alert
              icon={<IconInfoCircle size="1rem" />}
              title="Last Processing Error"
              color="red"
              variant="light"
              mt="md"
            >
              {processingState.error_message}
            </Alert>
          )}
        </Card>
      </div>
    </Container>
  );
};
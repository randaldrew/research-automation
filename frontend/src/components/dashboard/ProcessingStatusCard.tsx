// frontend/src/components/dashboard/ProcessingStatusCard.tsx
import React, { useState } from 'react';
import {
  Card,
  Text,
  Progress,
  Group,
  Badge,
  Button,
  Stack,
  Alert,
  Timeline,
  ActionIcon,
  Collapse,
  ScrollArea,
  Divider
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconActivity
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useProcessingStore } from '../../hooks/useProcessingStore';

export const ProcessingStatusCard: React.FC = () => {
  const {
    processingState,
    isLoading,
    error,
    startProcessing,
    stopProcessing,
    clearError
  } = useProcessingStore();

  const [logsOpened, { toggle: toggleLogs }] = useDisclosure(false);
  const [startingProcessing, setStartingProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every second while processing
  React.useEffect(() => {
    if (processingState.status === 'running') {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [processingState.status]);

  const getStatusColor = () => {
    switch (processingState.status) {
      case 'running': return 'blue';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (processingState.status) {
      case 'running': return <IconActivity size="1rem" />;
      case 'completed': return <IconCheck size="1rem" />;
      case 'error': return <IconX size="1rem" />;
      default: return <IconClock size="1rem" />;
    }
  };

  const formatDuration = () => {
      if (!processingState.start_time) return null;

      const start = new Date(processingState.start_time);
      const end = processingState.end_time ? new Date(processingState.end_time) : currentTime;
      const durationMs = end.getTime() - start.getTime();

      // Handle clock skew/timezone issues
      if (durationMs < 0) {
          return '0m 0s';
      }

      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);

      return `${minutes}m ${seconds}s`;
  };

  const handleStartProcessing = () => {
    modals.openConfirmModal({
      title: 'Start Processing',
      children: (
        <Text size="sm">
          This will fetch new newsletters, generate AI summaries, and extract links.
          Processing typically takes 5-10 minutes depending on the amount of content.
        </Text>
      ),
      labels: { confirm: 'Start Processing', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: async () => {
        setStartingProcessing(true);
        try {
          await startProcessing();
        } catch (error) {
          // Error handling is done in the store
        } finally {
          setStartingProcessing(false);
        }
      },
    });
  };

  const handleStopProcessing = () => {
    modals.openConfirmModal({
      title: 'Stop Processing',
      children: (
        <Text size="sm">
          Are you sure you want to stop the current processing run?
          This will interrupt the current operation and may leave some content unprocessed.
        </Text>
      ),
      labels: { confirm: 'Stop Processing', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await stopProcessing();
        } catch (error) {
          // Error handling is done in the store
        }
      },
    });
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            {getStatusIcon()}
            <Text size="lg" fw={600}>Processing Status</Text>
            <Badge
              color={getStatusColor()}
              variant="light"
              leftSection={processingState.status === 'running' ? <IconActivity size="0.8rem" /> : undefined}
            >
              {processingState.status === 'running' ? 'Running' : processingState.status.charAt(0).toUpperCase() + processingState.status.slice(1)}
            </Badge>
          </Group>

          {/* Action Button */}
          {processingState.status === 'idle' && (
            <Button
              leftSection={<IconPlayerPlay size="1rem" />}
              onClick={handleStartProcessing}
              loading={startingProcessing || isLoading}
              size="sm"
            >
              Start Processing
            </Button>
          )}

          {processingState.status === 'running' && (
            <Button
              leftSection={<IconPlayerStop size="1rem" />}
              onClick={handleStopProcessing}
              color="red"
              variant="light"
              size="sm"
            >
              Stop
            </Button>
          )}
        </Group>

        {/* Error Display */}
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Error"
            color="red"
            variant="light"
            withCloseButton
            onClose={clearError}
          >
            {error}
          </Alert>
        )}

        {/* Processing Progress */}
        {processingState.status === 'running' && (
          <>
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  {processingState.current_step}
                </Text>
                <Text size="sm" c="dimmed">
                  {processingState.progress}/{processingState.total_steps}
                </Text>
              </Group>

              <Progress
                value={(processingState.progress / processingState.total_steps) * 100}
                size="lg"
                radius="xl"
                animated
              />
            </div>

            {formatDuration() && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Duration:</Text>
                <Text size="sm">{formatDuration()}</Text>
              </Group>
            )}
          </>
        )}

        {/* Results Summary */}
        {(processingState.status === 'completed' || processingState.status === 'error') && processingState.results && (
          <>
            <Divider />
            <div>
              <Text size="sm" fw={500} mb="xs">Results Summary</Text>
              <Group>
                {processingState.results.content_fetched !== undefined && (
                  <Badge variant="light" color="blue">
                    {processingState.results.content_fetched} items fetched
                  </Badge>
                )}
                {processingState.results.summaries_generated !== undefined && (
                  <Badge variant="light" color="green">
                    {processingState.results.summaries_generated} summaries
                  </Badge>
                )}
                {processingState.results.links_processed !== undefined && (
                  <Badge variant="light" color="orange">
                    {processingState.results.links_processed} links
                  </Badge>
                )}
                {processingState.results.exports_generated !== undefined && (
                  <Badge variant="light" color="purple">
                    {processingState.results.exports_generated} exports
                  </Badge>
                )}
              </Group>

              {formatDuration() && (
                <Group justify="space-between" mt="sm">
                  <Text size="sm" c="dimmed">Total Duration:</Text>
                  <Text size="sm" fw={500}>{formatDuration()}</Text>
                </Group>
              )}
            </div>
          </>
        )}

        {/* Processing Logs */}
        {processingState.logs.length > 0 && (
          <>
            <Divider />
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Processing Logs</Text>
                <ActionIcon variant="light" onClick={toggleLogs} size="sm">
                  {logsOpened ? <IconChevronUp size="1rem" /> : <IconChevronDown size="1rem" />}
                </ActionIcon>
              </Group>

              <Collapse in={logsOpened}>
                <ScrollArea h={200}>
                  <Timeline active={processingState.logs.length - 1}>
                    {processingState.logs.slice(-10).map((log, index) => (
                      <Timeline.Item
                        key={index}
                        bullet={
                          log.level === 'error' ? <IconX size="0.8rem" /> :
                          log.level === 'warning' ? <IconAlertCircle size="0.8rem" /> :
                          <IconCheck size="0.8rem" />
                        }
                        color={
                          log.level === 'error' ? 'red' :
                          log.level === 'warning' ? 'yellow' :
                          'blue'
                        }
                      >
                        <Text size="xs" c="dimmed">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Text>
                        <Text size="sm">{log.message}</Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </ScrollArea>
              </Collapse>
            </div>
          </>
        )}

        {/* Idle State */}
        {processingState.status === 'idle' && (
          <Alert icon={<IconClock size="1rem" />} color="gray" variant="light">
            <Text size="sm">
              Ready to process new content. Click "Start Processing" to fetch newsletters, generate summaries, and extract links.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
};
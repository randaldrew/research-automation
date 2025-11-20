// frontend/src/components/setup/steps/RSSFeedsStep.tsx
import React, { useState } from 'react';
import {
  Stack,
  TextInput,
  NumberInput,
  Button,
  Group,
  Alert,
  Text,
  Card,
  Badge,
  Loader,
  ActionIcon,
  Modal
} from '@mantine/core';
import {
  IconRss,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconExternalLink
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const RSSFeedsStep: React.FC = () => {
  const {
    rssFeeds,
    rssTestResults,
    isTesting,
    addRSSFeed,
    removeRSSFeed,
    testRSSFeed
  } = useSetupStore();

  const [opened, { open, close }] = useDisclosure(false);
  const [newFeed, setNewFeed] = useState({
    name: '',
    rss_url: '',
    episodes_to_fetch: 1
  });

  const handleAddFeed = () => {
    if (!newFeed.name || !newFeed.rss_url) return;

    const feedId = newFeed.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    addRSSFeed(feedId, newFeed);

    setNewFeed({
      name: '',
      rss_url: '',
      episodes_to_fetch: 1
    });
    close();
  };

  const getTestStatusBadge = (feedId: string) => {
    if (isTesting) {
      return <Badge color="blue" leftSection={<Loader size="xs" />}>Testing...</Badge>;
    }

    const testResult = rssTestResults[feedId];
    if (!testResult) {
      return <Badge color="gray">Not Tested</Badge>;
    }

    return testResult.success ? (
      <Badge color="green" leftSection={<IconCheck size="0.8rem" />}>Valid</Badge>
    ) : (
      <Badge color="red" leftSection={<IconX size="0.8rem" />}>Failed</Badge>
    );
  };

  const getFeedCount = () => Object.keys(rssFeeds).length;

  return (
    <Stack gap="lg">
      <div>
        <Text size="xl" fw={600} mb="xs">RSS Feeds Configuration</Text>
        <Text c="dimmed" size="sm">
          Configure podcast RSS feeds to automatically process new episodes.
          Some default feeds are included, but you can customize them.
        </Text>
      </div>

      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="Podcast Processing"
        color="blue"
        variant="light"
      >
        <Text size="sm">
          The system will fetch transcripts when available and summarize podcast content.
          If transcripts aren't available, it will use episode descriptions and show notes.
        </Text>
      </Alert>

      {/* Configured Feeds */}
      {getFeedCount() > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Card.Section withBorder inheritPadding py="xs">
            <Group justify="space-between">
              <Text fw={500}>Configured Feeds ({getFeedCount()})</Text>
              <Button
                leftSection={<IconPlus size="1rem" />}
                variant="light"
                size="sm"
                onClick={open}
              >
                Add Feed
              </Button>
            </Group>
          </Card.Section>

          <Stack gap="md" mt="md">
            {Object.entries(rssFeeds).map(([feedId, feed]) => {
              const testResult = rssTestResults[feedId];

              return (
                <Card key={feedId} shadow="xs" padding="md" radius="sm" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Group>
                      <IconRss size="1.2rem" color="orange" />
                      <Text fw={500}>{feed.name}</Text>
                      {getTestStatusBadge(feedId)}
                    </Group>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => testRSSFeed(feedId)}
                        disabled={isTesting}
                      >
                        <IconCheck size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => removeRSSFeed(feedId)}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Group>
                  </Group>

                  <Stack gap="xs">
                    <Group gap="md">
                      <Text size="sm" c="dimmed">URL:</Text>
                      <Text size="sm" style={{ wordBreak: 'break-all' }}>
                        {feed.rss_url}
                      </Text>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => window.open(feed.rss_url, '_blank')}
                      >
                        <IconExternalLink size="0.8rem" />
                      </ActionIcon>
                    </Group>

                    <Group gap="md">
                      <Text size="sm" c="dimmed">Episodes to fetch:</Text>
                      <Text size="sm">{feed.episodes_to_fetch}</Text>
                    </Group>
                  </Stack>

                  {testResult && !testResult.success && (
                    <Alert
                      icon={<IconX size="0.8rem" />}
                      color="red"
                      variant="light"
                      mt="xs"
                    >
                      {testResult.error || 'Feed test failed'}
                    </Alert>
                  )}

                  {testResult && testResult.success && (
                    <Alert
                      icon={<IconCheck size="0.8rem" />}
                      color="green"
                      variant="light"
                      mt="xs"
                    >
                      <Text size="sm">
                        <Text fw={500} component="span">Feed is accessible!</Text>
                      </Text>
                    </Alert>
                  )}
                </Card>
              );
            })}
          </Stack>
        </Card>
      )}

      {/* Empty state */}
      {getFeedCount() === 0 && (
        <Card shadow="sm" padding="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
          <IconRss size={48} color="gray" style={{ margin: '0 auto 16px' }} />
          <Text size="lg" fw={500} mb="xs">No RSS Feeds Configured</Text>
          <Text c="dimmed" size="sm" mb="md">
            Add podcast RSS feeds to automatically process new episodes
          </Text>
          <Button
            leftSection={<IconPlus size="1rem" />}
            onClick={open}
          >
            Add Your First Feed
          </Button>
        </Card>
      )}

      {/* Add Feed Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="Add RSS Feed"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Feed Name"
            placeholder="e.g. My Favorite Podcast"
            value={newFeed.name}
            onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <TextInput
            label="RSS URL"
            placeholder="https://example.com/feed.xml"
            value={newFeed.rss_url}
            onChange={(e) => setNewFeed(prev => ({ ...prev, rss_url: e.target.value }))}
            leftSection={<IconRss size="1rem" />}
            required
          />

          <NumberInput
            label="Episodes to Fetch"
            description="Number of recent episodes to process per run"
            value={newFeed.episodes_to_fetch}
            onChange={(value) => setNewFeed(prev => ({
              ...prev,
              episodes_to_fetch: typeof value === 'number' ? value : (parseInt(value as string) || 1)
            }))}
            min={1}
            max={10}
          />

          <Group justify="space-between" mt="md">
            <Button variant="light" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={handleAddFeed}
              disabled={!newFeed.name || !newFeed.rss_url}
            >
              Add Feed
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="RSS Feed Requirements"
        color="yellow"
        variant="light"
      >
        <Text size="sm">
          <Text fw={500} component="span">Optional Step:</Text> RSS feeds are not required for basic newsletter processing.
          You can skip this step and add feeds later if you primarily process email newsletters rather than podcasts.
        </Text>
      </Alert>
    </Stack>
  );
};
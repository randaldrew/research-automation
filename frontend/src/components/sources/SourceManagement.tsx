// frontend/src/components/sources/SourceManagement.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Alert,
  Badge,
  ActionIcon,
  Menu,
  Table,
  Switch,
  Loader,
  SimpleGrid,
} from '@mantine/core';
import {
  IconPlus,
  IconSettings,
  IconTrash,
  IconTestPipe,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconDots,
  IconWorld,
  IconMail,
  IconRss,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useSourcesStore } from '../../hooks/useSourcesStore';
import { CreateSourceModal } from './CreateSourceModal';
import { EditSourceModal } from './EditSourceModal';
import { SourceTestModal } from './SourceTestModal';

const getSourceDisplayName = (source: any) => {
  switch (source.type) {
    case 'email':
      const emailAddress = source.config?.username || source.config?.email;
      return emailAddress ? `Email Inbox (${emailAddress})` : 'Email Inbox';

    case 'rss':
      const feedName = source.config?.name || source.name;
      return feedName !== source.source_id ? feedName : `RSS Feed (${source.source_id})`;

    case 'web':
      const url = source.config?.base_url;
      if (url) {
        try {
          const domain = new URL(url).hostname;
          return `Web Scraper (${domain})`;
        } catch {
          return 'Web Scraper';
        }
      }
      return 'Web Scraper';

    default:
      return source.name || source.source_id;
  }
};

export const SourceManagement: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const {
    sources,
    availablePlugins,
    selectedSource,
    isLoading,
    isSaving,
    error,
    testResults,
    loadSources,
    loadAvailablePlugins,
    deleteSource,
    enableSource,
    disableSource,
    setSelectedSource,
    clearError,
    refresh,
  } = useSourcesStore();

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadSources(),
        loadAvailablePlugins(),
      ]);
    };

    initializeData();
  }, [loadSources, loadAvailablePlugins]);

  const handleDeleteSource = (sourceId: string) => {
    const source = sources[sourceId];

    modals.openConfirmModal({
      title: 'Delete Source',
      children: (
        <Text size="sm">
          Are you sure you want to delete "{source?.name}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const success = await deleteSource(sourceId);
        if (success) {
          notifications.show({
            title: 'Source Deleted',
            message: `Successfully deleted ${source?.name}`,
            color: 'green',
            icon: <IconCheck size="1rem" />,
          });
        }
      },
    });
  };

  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    const success = enabled
      ? await enableSource(sourceId)
      : await disableSource(sourceId);

    if (success) {
      notifications.show({
        title: enabled ? 'Source Enabled' : 'Source Disabled',
        message: `${sources[sourceId]?.name} has been ${enabled ? 'enabled' : 'disabled'}`,
        color: 'blue',
        icon: <IconCheck size="1rem" />,
      });
    }
  };

  const handleTestSource = async (sourceId: string) => {
    setSelectedSource(sourceId);
    setTestModalOpen(true);
  };

  const handleEditSource = (sourceId: string) => {
    setSelectedSource(sourceId);
    setEditModalOpen(true);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'email':
        return <IconMail size="1rem" />;
      case 'rss':
        return <IconRss size="1rem" />;
      case 'web':
        return <IconWorld size="1rem" />;
      default:
        return <IconSettings size="1rem" />;
    }
  };

  const getStatusBadge = (sourceId: string, enabled: boolean, pluginAvailable: boolean) => {
    if (!enabled) {
      return <Badge color="gray" variant="light" size="sm">Disabled</Badge>;
    }

    if (!pluginAvailable) {
      return <Badge color="red" variant="light" size="sm">Plugin Missing</Badge>;
    }

    const testResult = testResults[sourceId];
    if (testResult) {
      return (
        <Badge
          color={testResult.success ? 'green' : 'red'}
          variant="light"
          size="sm"
        >
          {testResult.success ? 'Tested OK' : 'Test Failed'}
        </Badge>
      );
    }

    return <Badge color="blue" variant="light" size="sm">Ready</Badge>;
  };

  if (isLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="center" p="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading sources...</Text>
        </Group>
      </Card>
    );
  }

  const sourcesList = Object.values(sources);

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>Content Sources</Title>
          <Text size="sm" c="dimmed">
            Manage your content sources like email, RSS feeds, and web scrapers
          </Text>
        </div>

        <Group gap="sm">
          <Button
            leftSection={<IconPlus size="1rem" />}
            onClick={() => setCreateModalOpen(true)}
            disabled={availablePlugins.length === 0}
          >
            Add Source
          </Button>

          <Button
            variant="light"
            leftSection={isLoading ? <Loader size="1rem" /> : null}
            onClick={refresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Error Alert */}
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

      {/* Available Plugins Info */}
      {availablePlugins.length > 0 && (
        <Card shadow="sm" padding="sm" radius="md" withBorder>
          <Group gap="xs" wrap="wrap">
            <Text size="sm" fw={500}>Available source types:</Text>
            {availablePlugins.map(plugin => (
              <Badge key={plugin.plugin_type} variant="outline" size="sm">
                {plugin.name}
              </Badge>
            ))}
          </Group>
        </Card>
      )}

      {/* Sources List */}
      {sourcesList.length === 0 ? (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Stack align="center" gap="sm">
            <IconSettings size="3rem" color="gray" />
            <Title order={4} c="dimmed">No Sources Configured</Title>
            <Text size="sm" c="dimmed" ta="center">
              You haven't set up any content sources yet. Click "Add Source" to get started.
            </Text>
            <Button
              leftSection={<IconPlus size="1rem" />}
              onClick={() => setCreateModalOpen(true)}
              disabled={availablePlugins.length === 0}
            >
              Add Your First Source
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Source</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Enabled</Table.Th>
                <Table.Th style={{ width: '80px' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sourcesList.map((source) => (
                <Table.Tr key={source.source_id}>
                  <Table.Td>
                    <Group gap="sm">
                      {getSourceIcon(source.type)}
                      <div>
                        <Text fw={500} size="sm">{getSourceDisplayName(source)}</Text>
                      </div>
                    </Group>
                  </Table.Td>

                  <Table.Td>
                    <Badge variant="outline" size="sm">
                      {source.type.toUpperCase()}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    {getStatusBadge(source.source_id, source.enabled, source.plugin_available)}
                  </Table.Td>

                  <Table.Td>
                    <Switch
                      checked={source.enabled}
                      onChange={(event) =>
                        handleToggleSource(source.source_id, event.currentTarget.checked)
                      }
                      disabled={isSaving || !source.plugin_available}
                    />
                  </Table.Td>

                  <Table.Td>
                    <Menu position="bottom-end" shadow="md">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDots size="1rem" />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconSettings size="1rem" />}
                          onClick={() => handleEditSource(source.source_id)}
                        >
                          Edit
                        </Menu.Item>

                        <Menu.Item
                          leftSection={<IconTestPipe size="1rem" />}
                          onClick={() => handleTestSource(source.source_id)}
                          disabled={!source.plugin_available}
                        >
                          Test
                        </Menu.Item>

                        <Menu.Divider />

                        <Menu.Item
                          leftSection={<IconTrash size="1rem" />}
                          color="red"
                          onClick={() => handleDeleteSource(source.source_id)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Statistics */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="xs">
            <IconSettings size="1.5rem" color="blue" />
            <div>
              <Text size="xs" c="dimmed">Total Sources</Text>
              <Text fw={500}>{sourcesList.length}</Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="xs">
            <IconCheck size="1.5rem" color="green" />
            <div>
              <Text size="xs" c="dimmed">Enabled</Text>
              <Text fw={500}>{sourcesList.filter(s => s.enabled).length}</Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="xs">
            <IconX size="1.5rem" color="red" />
            <div>
              <Text size="xs" c="dimmed">Disabled</Text>
              <Text fw={500}>{sourcesList.filter(s => !s.enabled).length}</Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap="xs">
            <IconAlertCircle size="1.5rem" color="orange" />
            <div>
              <Text size="xs" c="dimmed">Issues</Text>
              <Text fw={500}>{sourcesList.filter(s => !s.plugin_available).length}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Modals */}
      <CreateSourceModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        availablePlugins={availablePlugins}
      />

      <EditSourceModal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedSource(null);
        }}
        sourceId={selectedSource}
        source={selectedSource ? sources[selectedSource] : null}
      />

      <SourceTestModal
        opened={testModalOpen}
        onClose={() => {
          setTestModalOpen(false);
          setSelectedSource(null);
        }}
        sourceId={selectedSource}
        source={selectedSource ? sources[selectedSource] : null}
      />
    </Stack>
  );
};
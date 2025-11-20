// frontend/src/components/setup/steps/ObsidianStep.tsx
import React from 'react';
import {
  Stack,
  TextInput,
  Group,
  Alert,
  Text,
  Card,
  Switch,
  Grid,
  Divider
} from '@mantine/core';
import {
  IconFolder,
  IconCheck,
  IconInfoCircle,
  IconMountain,
} from '@tabler/icons-react';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const ObsidianStep: React.FC = () => {
  const {
    obsidianConfig,
    updateObsidianConfig,
  } = useSetupStore();

  const handleVaultPathChange = (value: string) => {
    updateObsidianConfig({ obsidian_vault_path: value });
  };

  const handleSummariesFolderChange = (value: string) => {
    updateObsidianConfig({ obsidian_summaries_folder: value });
  };

  const handleObsidianToggle = (enabled: boolean) => {
    updateObsidianConfig({ enabled: enabled });

    // If disabling, clear the paths
    if (!enabled) {
      updateObsidianConfig({
        obsidian_vault_path: '',
        obsidian_summaries_folder: 'Newsletter Summaries'
      });
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Text size="lg" fw={600} mb="xs">
          Obsidian Integration (Optional)
        </Text>
        <Text size="sm" c="dimmed">
          Configure your Obsidian vault to automatically export weekly summaries.
          This step is completely optional - you can skip it and configure later in Settings.
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="md">
            <IconMountain size="2rem" color="var(--mantine-color-purple-6)" />
            <div style={{ flex: 1 }}>
              <Text fw={500}>Enable Obsidian Export</Text>
              <Text size="xs" c="dimmed">
                Export your weekly research summaries directly to your Obsidian vault
              </Text>
            </div>
            <Switch
              size="md"
              checked={obsidianConfig.enabled}
              onChange={(event) => handleObsidianToggle(event.currentTarget.checked)}
            />
          </Group>

          {obsidianConfig.enabled && (
            <>
              <Divider />

              <Grid>
                <Grid.Col span={12}>
                  <TextInput
                    label="Obsidian Vault Path"
                    placeholder="/Users/yourname/Documents/Obsidian Vault"
                    description="Full path to your Obsidian vault directory"
                    value={obsidianConfig.obsidian_vault_path}
                    onChange={(e) => handleVaultPathChange(e.target.value)}
                    leftSection={<IconFolder size="1rem" />}
                  />
                </Grid.Col>

                <Grid.Col span={12}>
                  <TextInput
                    label="Summaries Folder"
                    placeholder="Newsletter Summaries"
                    description="Folder within your vault where weekly summaries will be saved"
                    value={obsidianConfig.obsidian_summaries_folder}
                    onChange={(e) => handleSummariesFolderChange(e.target.value)}
                    leftSection={<IconFolder size="1rem" />}
                  />
                </Grid.Col>
              </Grid>

              <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
                <Text size="sm">
                  <strong>Example path structure:</strong><br />
                  Your vault: <code>/Users/yourname/Documents/Obsidian Vault</code><br />
                  Summaries will be saved to: <code>/Users/yourname/Documents/Obsidian Vault/Newsletter Summaries/Weekly Summary 2025-09-16.md</code>
                </Text>
              </Alert>

              {obsidianConfig.obsidian_vault_path && (
                <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
                  <Text size="sm">
                    Weekly summaries will be exported to:<br />
                    <code style={{ wordBreak: 'break-all' }}>
                      {obsidianConfig.obsidian_vault_path}/{obsidianConfig.obsidian_summaries_folder || 'Newsletter Summaries'}
                    </code>
                  </Text>
                </Alert>
              )}
            </>
          )}
        </Stack>
      </Card>

      {!obsidianConfig.enabled && (
        <Alert icon={<IconInfoCircle size="1rem" />} color="gray" variant="light">
          <Text size="sm">
            <strong>Skip Obsidian Integration:</strong> You can always configure this later in Settings.
            Weekly summaries will still be available for download from the Summaries page.
          </Text>
        </Alert>
      )}
    </Stack>
  );
};
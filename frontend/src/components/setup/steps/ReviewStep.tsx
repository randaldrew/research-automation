// frontend/src/components/setup/steps/ReviewStep.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Text,
  Card,
  Group,
  Badge,
  Alert,
  Button,
  Grid,
  Divider,
  List,
  Loader
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconAlertCircle,
  IconMail,
  IconRobot,
  IconLink,
  IconRss,
  IconSettings,
  IconInfoCircle,
  IconMountain,
} from '@tabler/icons-react';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const ReviewStep: React.FC = () => {
  const {
    emailConfig,
    apiKeysConfig,
    rssFeeds,
    processingConfig,
    obsidianConfig,
    emailTestResult,
    claudeTestResult,
    linkpreviewTestResult,
    rssTestResults,
    error,
    validateConfiguration
  } = useSetupStore();

  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Run validation when component mounts
    runValidation();
  }, []);

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const isValid = await validateConfiguration();
      setValidationResult({ valid: isValid });
    } catch (error) {
      setValidationResult({ valid: false, error });
    } finally {
      setIsValidating(false);
    }
  };

  const getConfigurationSummary = () => {
    const summary = {
      email: {
        configured: !!emailConfig.username && !!emailConfig.password,
        tested: !!emailTestResult,
        working: emailTestResult?.success || false
      },
      claude: {
        configured: !!apiKeysConfig.claude_api_key,
        tested: !!claudeTestResult,
        working: claudeTestResult?.success || false
      },
      linkpreview: {
        configured: !!apiKeysConfig.linkpreview_api_key,
        tested: !!linkpreviewTestResult,
        working: linkpreviewTestResult?.success || false,
        enabled: processingConfig.enable_link_enrichment
      },
      rss: {
        configured: Object.keys(rssFeeds).length > 0,
        tested: Object.keys(rssTestResults).length > 0,
        working: Object.values(rssTestResults).some(result => result.success)
      }
    };

    return summary;
  };

  const summary = getConfigurationSummary();

  const getStatusBadge = (configured: boolean, tested: boolean, working: boolean) => {
    if (!configured) return <Badge color="red">Not Configured</Badge>;
    if (!tested) return <Badge color="yellow">Not Tested</Badge>;
    if (!working) return <Badge color="red">Test Failed</Badge>;
    return <Badge color="green" leftSection={<IconCheck size="0.8rem" />}>Ready</Badge>;
  };

  const getOverallStatus = () => {
    const required = [summary.email, summary.claude];
    const allRequiredWorking = required.every(item => item.configured && item.working);

    if (allRequiredWorking) {
      return { color: 'green', label: 'Ready to Complete', icon: <IconCheck size="1rem" /> };
    }

    const hasIssues = required.some(item => !item.configured || (item.tested && !item.working));
    if (hasIssues) {
      return { color: 'red', label: 'Issues Found', icon: <IconX size="1rem" /> };
    }

    return { color: 'yellow', label: 'Needs Testing', icon: <IconAlertCircle size="1rem" /> };
  };

  const overallStatus = getOverallStatus();

  return (
    <Stack gap="lg">
      <div>
        <Text size="xl" fw={600} mb="xs">Review & Complete Setup</Text>
        <Text color="dimmed" size="sm">
          Review your configuration and complete the setup process.
        </Text>
      </div>

      {/* Overall Status */}
      <Alert
        icon={overallStatus.icon}
        title="Configuration Status"
        color={overallStatus.color}
        variant="light"
      >
        <Text size="sm">{overallStatus.label}</Text>
      </Alert>

      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} title="Validation Error" color="red">
          {error}
        </Alert>
      )}

      {/* Configuration Summary */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="lg" fw={600} mb="md">Configuration Summary</Text>

        <Stack gap="md">
          {/* Email Configuration */}
          <Group justify="space-between">
            <Group>
              <IconMail size="1.2rem" />
              <div>
                <Text fw={500}>Email Configuration</Text>
                <Text size="sm" color="dimmed">
                  {emailConfig.username || 'Not configured'}
                </Text>
              </div>
            </Group>
            {getStatusBadge(summary.email.configured, summary.email.tested, summary.email.working)}
          </Group>

          <Divider />

          {/* Claude API */}
          <Group justify="space-between">
            <Group>
              <IconRobot size="1.2rem" />
              <div>
                <Text fw={500}>Claude API</Text>
                <Text size="sm" color="dimmed">
                  {processingConfig.claude_model}
                </Text>
              </div>
            </Group>
            {getStatusBadge(summary.claude.configured, summary.claude.tested, summary.claude.working)}
          </Group>

          <Divider />

          {/* LinkPreview API */}
          <Group justify="space-between">
            <Group>
              <IconLink size="1.2rem" />
              <div>
                <Text fw={500}>LinkPreview API</Text>
                <Text size="sm" color="dimmed">
                  {summary.linkpreview.enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </div>
            </Group>
            {summary.linkpreview.enabled ? (
              getStatusBadge(summary.linkpreview.configured, summary.linkpreview.tested, summary.linkpreview.working)
            ) : (
              <Badge color="gray">Disabled</Badge>
            )}
          </Group>

          <Divider />

          {/* RSS Feeds */}
          <Group justify="space-between">
            <Group>
              <IconRss size="1.2rem" />
              <div>
                <Text fw={500}>RSS Feeds</Text>
                <Text size="sm" color="dimmed">
                  {Object.keys(rssFeeds).length} feed(s) configured
                </Text>
              </div>
            </Group>
            {Object.keys(rssFeeds).length > 0 ? (
              getStatusBadge(summary.rss.configured, summary.rss.tested, summary.rss.working)
            ) : (
              <Badge color="gray">Optional</Badge>
            )}
          </Group>

          <Divider />

          {/* Processing Settings */}
          <Group justify="space-between">
            <Group>
              <IconSettings size="1.2rem" />
              <div>
                <Text fw={500}>Processing Settings</Text>
                <Text size="sm" color="dimmed">
                  Max {processingConfig.max_articles_per_run} articles per run
                </Text>
              </div>
            </Group>
            <Badge color="blue">Configured</Badge>
          </Group>
        </Stack>
      </Card>

      {/* Detailed Configuration */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="lg" fw={600} mb="md">Detailed Configuration</Text>

        <Grid>
          <Grid.Col span={6}>
            <Text size="sm" fw={500} mb="xs">Email Settings</Text>
            <List size="sm" spacing="xs">
              <List.Item>Server: {emailConfig.server}</List.Item>
              <List.Item>Folder: {emailConfig.folder}</List.Item>
              <List.Item>Notification Email: {emailConfig.notification_email || 'Not set'}</List.Item>
            </List>
          </Grid.Col>

          <Grid.Col span={6}>
            <Text size="sm" fw={500} mb="xs">Processing Settings</Text>
            <List size="sm" spacing="xs">
              <List.Item>Model: {processingConfig.claude_model}</List.Item>
              <List.Item>Max Articles: {processingConfig.max_articles_per_run}</List.Item>
              <List.Item>
                Link Enrichment: {processingConfig.enable_link_enrichment ? 'Enabled' : 'Disabled'}
              </List.Item>
              {processingConfig.enable_link_enrichment && (
                <List.Item>Max Links: {processingConfig.max_links_to_enrich}</List.Item>
              )}
            </List>
          </Grid.Col>
        </Grid>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
                <Group gap="sm">
                    <IconMountain size="1.5rem" color="var(--mantine-color-purple-6)"/>
                    <Text fw={500} size="lg">Obsidian Integration</Text>
                </Group>

                {obsidianConfig.enabled ? (
                    <Stack gap="xs">
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">Status:</Text>
                            <Badge color="green" variant="light">
                                <IconCheck size="0.8rem" style={{marginRight: '4px'}}/>
                                Enabled
                            </Badge>
                        </Group>

                        <Group justify="space-between" align="flex-start">
                            <Text size="sm" c="dimmed">Vault Path:</Text>
                            <Text size="sm" ta="right" style={{maxWidth: '60%', wordBreak: 'break-all'}}>
                                {obsidianConfig.obsidian_vault_path || 'Not specified'}
                            </Text>
                        </Group>

                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">Summaries Folder:</Text>
                            <Text size="sm">{obsidianConfig.obsidian_summaries_folder || 'Newsletter Summaries'}</Text>
                        </Group>

                        <Alert icon={<IconInfoCircle size="1rem"/>} color="purple" variant="light">
                            <Text size="xs">
                                Weekly summaries will be exported to your Obsidian vault automatically.
                            </Text>
                        </Alert>
                    </Stack>
                ) : (
                    <Stack gap="xs">
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">Status:</Text>
                            <Badge color="gray" variant="light">Disabled</Badge>
                        </Group>

                        <Alert icon={<IconInfoCircle size="1rem"/>} color="gray" variant="light">
                            <Text size="xs">
                                Obsidian integration is disabled. You can enable it later in Settings.
                                Weekly summaries will be available for download from the Summaries page.
                            </Text>
                        </Alert>
                    </Stack>
                )}
            </Stack>
        </Card>

        {Object.keys(rssFeeds).length > 0 && (
          <>
            <Divider my="md" />
            <Text size="sm" fw={500} mb="xs">RSS Feeds</Text>
            <List size="sm" spacing="xs">
              {Object.entries(rssFeeds).map(([feedId, feed]) => (
                <List.Item key={feedId}>
                  {feed.name} - {feed.episodes_to_fetch} episode(s)
                </List.Item>
              ))}
            </List>
          </>
        )}
      </Card>

      {/* Next Steps */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="lg" fw={600} mb="md">What happens next?</Text>

        <List spacing="sm">
          <List.Item icon={<IconCheck size="1rem" color="green" />}>
            Your configuration will be saved securely
          </List.Item>
          <List.Item icon={<IconCheck size="1rem" color="green" />}>
            The system will initialize the database
          </List.Item>
          <List.Item icon={<IconCheck size="1rem" color="green" />}>
            You'll be redirected to the dashboard
          </List.Item>
          <List.Item icon={<IconCheck size="1rem" color="green" />}>
            You can trigger your first processing run manually
          </List.Item>
        </List>
      </Card>

      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="Important Notes"
        color="blue"
        variant="light"
      >
        <Stack gap="xs">
          <Text size="sm">
            • Your API keys and passwords are stored securely in environment variables
          </Text>
          <Text size="sm">
            • The system won't run automatically - you control when processing happens
          </Text>
          <Text size="sm">
            • You can always modify these settings later in the dashboard
          </Text>
          <Text size="sm">
            • All data stays on your machine - nothing is sent to external services except the APIs you configured
          </Text>
        </Stack>
      </Alert>

      {/* Validation Status */}
      {isValidating && (
        <Alert icon={<Loader size="1rem" />} color="blue" variant="light">
          <Text size="sm">Validating configuration...</Text>
        </Alert>
      )}

      {validationResult && !validationResult.valid && (
        <Alert icon={<IconX size="1rem" />} color="red" variant="light">
          <Text size="sm">
            Configuration validation failed. Please check your settings and try again.
          </Text>
        </Alert>
      )}

      {/* Re-validate Button */}
      <Group justify="center">
        <Button
          variant="light"
          onClick={runValidation}
          loading={isValidating}
          leftSection={<IconCheck size="1rem" />}
        >
          Re-validate Configuration
        </Button>
      </Group>
    </Stack>
  );
};
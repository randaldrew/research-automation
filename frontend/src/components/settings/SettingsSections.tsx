// frontend/src/components/settings/SettingsSections.tsx
import React from 'react';
import {
  Stack,
  TextInput,
  PasswordInput,
  NumberInput,
  Select,
  Switch,
  Button,
  Group,
  Alert,
  Text,
  Card,
  Divider,
  Badge,
  Grid,
  Loader,
  Anchor,
} from '@mantine/core';
import {
  IconMail,
  IconKey,
  IconDatabase,
  IconCheck,
  IconX,
  IconExternalLink,
  IconInfoCircle,
  IconRobot,
  IconLink,
  IconShield,
  IconShieldOff,
  IconFolder,
  IconCalendarWeek,
} from '@tabler/icons-react';
import { useSettingsStore } from '../../hooks/useSettingsStore';
import { SourceManagement } from '../sources/SourceManagement';

// Email Settings Section
export const EmailSettingsSection: React.FC = () => {
  const {
    settings,
    emailTestResult,
    isTesting,
    updateEmailSettings,
    testEmailSettings
  } = useSettingsStore();

  if (!settings || !settings.email) return null;

  return (
    <Stack gap="md"> {/* ✅ FIXED: spacing="md" → gap="md" */}
      <div>
        <Text size="lg" fw={600} mb="xs">Email Configuration</Text>
        <Text size="sm" c="dimmed">
          Configure your Gmail account for automatic newsletter fetching
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Gmail Username"
              value={settings.email.username}
              onChange={(e) => updateEmailSettings({ username: e.target.value })}
              placeholder="your-newsletters@gmail.com"
              leftSection={<IconMail size="1rem" />}
              required
            />

            <TextInput
              label="Notification Email"
              value={settings.email.notification_email}
              onChange={(e) => updateEmailSettings({ notification_email: e.target.value })}
              placeholder="your-main@gmail.com"
              leftSection={<IconMail size="1rem" />}
              required
            />
          </Group>

          <PasswordInput
            label="App Password"
            value={settings.email.password}
            onChange={(e) => updateEmailSettings({ password: e.target.value })}
            placeholder="Your Gmail App Password"
            description="Gmail App Password (not your regular password)"
            required
          />

          <Group grow>
            <TextInput
              label="Email Folder"
              value={settings.email.folder}
              onChange={(e) => updateEmailSettings({ folder: e.target.value })}
              placeholder="INBOX"
            />

            <TextInput
              label="IMAP Server"
              value={settings.email.server}
              onChange={(e) => updateEmailSettings({ server: e.target.value })}
              placeholder="imap.gmail.com"
            />
          </Group>

          <Group grow>
            <TextInput
              label="SMTP Server"
              value={settings.email.smtp_server}
              onChange={(e) => updateEmailSettings({ smtp_server: e.target.value })}
              placeholder="smtp.gmail.com"
            />

            <NumberInput
              label="SMTP Port"
              value={settings.email.smtp_port}
              onChange={(value) => updateEmailSettings({
                smtp_port: typeof value === 'number' ? value : (parseInt(value as string) || 587)
              })}
              placeholder="587"
            />
          </Group>

          {emailTestResult && (
            <Alert
              icon={emailTestResult.success ? <IconCheck size="1rem" /> : <IconX size="1rem" />}
              color={emailTestResult.success ? 'green' : 'red'}
              variant="light"
            >
              {emailTestResult.success ?
                'Email connection successful!' :
                emailTestResult.error || 'Email connection failed'
              }
            </Alert>
          )}

          <Button
            onClick={testEmailSettings}
            loading={isTesting}
            variant="light"
            leftSection={<IconCheck size="1rem" />}
            size="sm"
          >
            Test Email Connection
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
};

// Enhanced API Keys Settings Section
// Add this to replace the existing APIKeysSettingsSection in SettingsSections.tsx

export const APIKeysSettingsSection: React.FC = () => {
  const {
    settings,
    claudeTestResult,
    linkpreviewTestResult,
    isTesting,
    updateAPISettings,
    testClaudeAPI,
    testLinkPreviewAPI
  } = useSettingsStore();

  if (!settings || !settings.apiKeys) {
    return (
      <Alert color="yellow" variant="light">
        Loading API settings...
      </Alert>
    );
  }

  // Helper function to get masked display value
  const getMaskedValue = (key: string | undefined) => {
      if (!key || key.trim() === '' || key === 'undefined') return '';
      if (key === '***MASKED***') return key; // Already masked from backend
      if (key.length <= 8) return '***...***';
      return key.substring(0, 8) + '***...***' + key.substring(key.length - 4);
  };

// Helper function to get configuration status
  const getConfigurationStatus = (key: string | undefined) => {
      const isConfigured = key && key.trim() !== '' && key !== 'undefined';
      return {
          isConfigured,
          badge: isConfigured ? (
              <Badge color="green" leftSection={<IconShield size="0.7rem"/>} size="sm">
                  Configured
              </Badge>
          ) : (
              <Badge color="gray" leftSection={<IconShieldOff size="0.7rem"/>} size="sm">
                  Not Set
              </Badge>
          )
      };
  };

// Helper function to get appropriate placeholder
  const getPlaceholder = (key: string | undefined, defaultPlaceholder: string) => {
      const {isConfigured} = getConfigurationStatus(key);
      return isConfigured ? 'Key is configured (hidden for security)' : defaultPlaceholder;
  };

  const getTestStatusBadge = (testResult: any, isRequired: boolean = true) => {
    if (isTesting) {
      return <Badge color="blue" leftSection={<Loader size="xs" />} size="sm">Testing...</Badge>;
    }

    if (!testResult) {
      return <Badge color="gray" size="sm">{isRequired ? 'Not Tested' : 'Optional'}</Badge>;
    }

    return testResult.success ? (
      <Badge color="green" leftSection={<IconCheck size="0.7rem" />} size="sm">Valid</Badge>
    ) : (
      <Badge color="red" leftSection={<IconX size="0.7rem" />} size="sm">Failed</Badge>
    );
  };

  const claudeStatus = getConfigurationStatus(settings.apiKeys.claude_api_key);
  const linkpreviewStatus = getConfigurationStatus(settings.apiKeys.linkpreview_api_key);

  return (
    <Stack gap="md">
      <div>
        <Text size="lg" fw={600} mb="xs">API Keys</Text>
        <Text size="sm" c="dimmed">
          Configure your API keys for AI processing and link enrichment
        </Text>
      </div>

      {/* Claude API Key Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Claude API (Required)</Text>
              <Text size="sm" c="dimmed">Powers AI summarization</Text>
            </div>
            <Group gap="xs">
              <Badge color="blue" leftSection={<IconRobot size="0.8rem" />} size="sm">Required</Badge>
              {claudeStatus.badge}
            </Group>
          </Group>

          <PasswordInput
              label="Claude API Key"
              placeholder={getPlaceholder(settings.apiKeys.claude_api_key, 'sk-ant-api03-...')}
              value={getMaskedValue(settings.apiKeys.claude_api_key)}
              onChange={(e) => updateAPISettings({claude_api_key: e.target.value})}
              leftSection={<IconKey size="1rem"/>}
              description={
                  <>
                      Get your API key from{' '}
                      <Anchor href="https://console.anthropic.com/" target="_blank" size="xs">
                          Anthropic Console <IconExternalLink size="0.8rem" style={{display: 'inline'}}/>
                      </Anchor>
                  </>
              }
              required
          />

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text size="sm" fw={500}>API Status</Text>
              {getTestStatusBadge(claudeTestResult, true)}
            </Group>
            <Button
              onClick={testClaudeAPI}
              loading={isTesting}
              disabled={!claudeStatus.isConfigured || isTesting}
              variant="light"
              leftSection={<IconCheck size="1rem" />}
              size="sm"
            >
              Test Claude API
            </Button>
          </Group>

          {claudeTestResult && (
            <Alert
              icon={claudeTestResult.success ? <IconCheck size="1rem" /> : <IconX size="1rem" />}
              color={claudeTestResult.success ? 'green' : 'red'}
              variant="light"
            >
              {claudeTestResult.success
                ? 'Claude API is working correctly!'
                : claudeTestResult.error || 'Claude API test failed'
              }
            </Alert>
          )}
        </Stack>
      </Card>

      {/* LinkPreview API Key Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>LinkPreview API (Optional)</Text>
              <Text size="sm" c="dimmed">Enhanced link previews and metadata</Text>
            </div>
            <Group gap="xs">
              <Badge color="gray" leftSection={<IconLink size="0.8rem" />} size="sm">Optional</Badge>
              {linkpreviewStatus.badge}
            </Group>
          </Group>

          <PasswordInput
              label="LinkPreview API Key"
              placeholder={getPlaceholder(settings.apiKeys.linkpreview_api_key, 'your-linkpreview-key')}
              value={getMaskedValue(settings.apiKeys.linkpreview_api_key || '')}
              onChange={(e) => updateAPISettings({linkpreview_api_key: e.target.value})}
              leftSection={<IconKey size="1rem"/>}
              description={
                  <>
                      Get your API key from{' '}
                      <Anchor href="https://www.linkpreview.net/" target="_blank" size="xs">
                          LinkPreview.net <IconExternalLink size="0.8rem" style={{display: 'inline'}}/>
                      </Anchor>
                      {' '}(Free tier: 1,000 requests/month)
                  </>
              }
          />

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text size="sm" fw={500}>API Status</Text>
              {getTestStatusBadge(linkpreviewTestResult, false)}
            </Group>
            <Button
              onClick={testLinkPreviewAPI}
              loading={isTesting}
              disabled={!linkpreviewStatus.isConfigured || isTesting}
              variant="light"
              leftSection={<IconCheck size="1rem" />}
              size="sm"
            >
              Test LinkPreview API
            </Button>
          </Group>

          {linkpreviewTestResult && (
            <Alert
              icon={linkpreviewTestResult.success ? <IconCheck size="1rem" /> : <IconX size="1rem" />}
              color={linkpreviewTestResult.success ? 'green' : 'red'}
              variant="light"
            >
              {linkpreviewTestResult.success
                ? 'LinkPreview API is working correctly!'
                : linkpreviewTestResult.error || 'LinkPreview API test failed'
              }
            </Alert>
          )}

          {!linkpreviewStatus.isConfigured && (
            <Alert icon={<IconInfoCircle size="1rem" />} color="gray" variant="light">
              <Text size="sm">
                Link enrichment will be disabled without a LinkPreview API key.
                Links will be extracted but won't have enhanced titles or descriptions.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Cost Information */}
      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="API Costs"
        color="blue"
        variant="light"
      >
        <Grid>
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>Claude API</Text>
            <Text size="sm">
              Typical usage: ~$0.10-0.50 per week for newsletter summaries.
              Pay-as-you-go pricing.
            </Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>LinkPreview API</Text>
            <Text size="sm">
              Free tier: 1,000 requests/month.
              Typically sufficient for personal use.
            </Text>
          </Grid.Col>
        </Grid>
      </Alert>
    </Stack>
  );
};

export const ProcessingSettingsSection: React.FC = () => {
  const { settings, updateProcessingSettings } = useSettingsStore();

  if (!settings) return null;

  const claudeModels = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended - Recent)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Stable)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5 (Fast & Economical)' }
];

  return (
    <Stack gap="md">
      <div>
        <Text size="lg" fw={600} mb="xs">Processing Configuration</Text>
        <Text size="sm" c="dimmed">
          Configure how your content will be processed and summarized
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          {/* EXISTING: Maximum Articles per Run */}
          <NumberInput
            label="Maximum Articles per Run"
            description="Limit the number of articles processed in a single run"
            value={settings.processing.max_articles_per_run}
            onChange={(value) => updateProcessingSettings({
              max_articles_per_run: typeof value === 'number' ? value : (parseInt(value as string) || 20)
            })}
            min={1}
            max={100}
          />

          {/* EXISTING: Claude Model */}
          <Select
            label="Claude Model"
            description="AI model for content summarization"
            value={settings.processing.claude_model}
            onChange={(value) => updateProcessingSettings({ claude_model: value || claudeModels[0].value })}
            data={claudeModels}
          />

          <Divider />

          {/* EXISTING: Link Enrichment */}
          <Switch
            label="Enable Link Enrichment"
            description="Fetch titles and descriptions for extracted links"
            checked={settings.processing.enable_link_enrichment}
            onChange={(e) => updateProcessingSettings({ enable_link_enrichment: e.currentTarget.checked })}
          />

          {/* EXISTING: Conditional Maximum Links */}
          {settings.processing.enable_link_enrichment && (
            <NumberInput
              label="Maximum Links to Enrich"
              description="Number of links to enhance per article"
              value={settings.processing.max_links_to_enrich}
              onChange={(value) => updateProcessingSettings({
                max_links_to_enrich: typeof value === 'number' ? value : (parseInt(value as string) || 10)
              })}
              min={1}
              max={50}
            />
          )}

          <Divider />

          {/* NEW: Weekly Summary Settings */}
          <Stack gap="md">
            <Group gap="sm">
              <IconCalendarWeek size="1.2rem" />
              <Text size="md" fw={500}>Weekly Summary Generation</Text>
            </Group>

            <Switch
              label="Auto-generate weekly summaries"
              description="Automatically create weekly summaries during processing when conditions are met"
              checked={settings.processing.auto_generate_weekly_summary}
              onChange={(e) => updateProcessingSettings({
                auto_generate_weekly_summary: e.currentTarget.checked
              })}
            />

            {settings.processing.auto_generate_weekly_summary && (
              <NumberInput
                label="Minimum days between summaries"
                description="How many days to wait before auto-generating another weekly summary"
                value={settings.processing.weekly_summary_min_days}
                onChange={(value) => updateProcessingSettings({
                  weekly_summary_min_days: typeof value === 'number' ? value : (parseInt(value as string) || 3)
                })}
                min={1}
                max={14}
                suffix=" days"
              />
            )}

            <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
              <Text size="sm">
                {settings.processing.auto_generate_weekly_summary
                  ? `Weekly summaries will be automatically generated during processing if it's been ${settings.processing.weekly_summary_min_days || 3}+ days since the last one and there are new individual summaries to include.`
                  : "Weekly summaries will only be generated when manually requested from the Summaries page."
                }
              </Text>
            </Alert>
          </Stack>

          <Divider />

          {/* EXISTING: Cost Estimation Alert */}
          <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
            <Text size="sm">
              <strong>Estimated cost per run:</strong> ${(settings.processing.max_articles_per_run * 0.02).toFixed(2)} - ${(settings.processing.max_articles_per_run * 0.05).toFixed(2)}
              <br />
              <strong>Processing time:</strong> ~{Math.ceil(settings.processing.max_articles_per_run / 3)} minutes
            </Text>
          </Alert>
        </Stack>
      </Card>
    </Stack>
  );
};

// System Settings Section
export const SystemSettingsSection: React.FC = () => {
  const { settings, status, updateSystemSettings } = useSettingsStore();

  if (!settings) return null;

  return (
    <Stack gap="md">
      <div>
        <Text size="lg" fw={600} mb="xs">System Configuration</Text>
        <Text size="sm" c="dimmed">
          System paths and application settings
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Data Directory"
              value={settings.system.data_directory}
              onChange={(e) => updateSystemSettings({ data_directory: e.target.value })}
              placeholder="/app/data"
              leftSection={<IconDatabase size="1rem" />}
              description="Main directory for storing application data"
            />

            <TextInput
              label="Database Path"
              value={settings.system.database_path}
              onChange={(e) => updateSystemSettings({ database_path: e.target.value })}
              placeholder="/app/data/database/insights.db"
              leftSection={<IconDatabase size="1rem" />}
              description="SQLite database file location"
            />
          </Group>

          <Group grow>
            <TextInput
              label="Obsidian Vault Path"
              value={settings.system.obsidian_vault_path}
              onChange={(e) => updateSystemSettings({ obsidian_vault_path: e.target.value })}
              placeholder="/path/to/obsidian/vault"
              leftSection={<IconDatabase size="1rem" />}
              description="Path to your Obsidian vault for exports"
            />

            <TextInput
              label="Summaries Folder"
              value={settings.system.obsidian_summaries_folder}
              onChange={(e) => updateSystemSettings({ obsidian_summaries_folder: e.target.value })}
              placeholder="Newsletter Summaries"
              leftSection={<IconFolder size="1rem" />}
              description="Folder within vault for weekly summaries"
            />
          </Group>

          <Group grow>
            <TextInput
              label="Exports Directory"
              value={settings.system.exports_directory}
              onChange={(e) => updateSystemSettings({ exports_directory: e.target.value })}
              placeholder="/app/data/exports"
              leftSection={<IconDatabase size="1rem" />}
              description="Directory for exported files"
            />
          </Group>

          <Group grow>
            <Select
              label="Log Level"
              value={settings.system.log_level}
              onChange={(value) => updateSystemSettings({ log_level: value || 'INFO' })}
              data={[
                { value: 'DEBUG', label: 'Debug' },
                { value: 'INFO', label: 'Info' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'ERROR', label: 'Error' }
              ]}
              description="Application logging level"
            />

            <NumberInput
              label="Backend Port"
              value={settings.system.backend_port}
              onChange={(value) => updateSystemSettings({
                backend_port: typeof value === 'number' ? value : (parseInt(value as string) || 8000)
              })}
              placeholder="8000"
              min={1000}
              max={65535}
              description="Port for the backend API server"
            />
          </Group>

          <TextInput
            label="Frontend URL"
            value={settings.system.frontend_url}
            onChange={(e) => updateSystemSettings({ frontend_url: e.target.value })}
            placeholder="http://localhost:3000"
            description="Frontend application URL"
          />


          <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
            <Text size="sm">
              <strong>System Status:</strong> {status?.is_configured ? 'Configured' : 'Not fully configured'}
              <br />
              <strong>Missing Requirements:</strong> {status?.missing_requirements?.join(', ') || 'None'}
            </Text>
          </Alert>

        </Stack>
      </Card>
    </Stack>
  );
};

export const SourcesSettingsSection: React.FC = () => {
  return (
    <Stack gap="lg">
      {/* Source Management Component */}
      <SourceManagement />
    </Stack>
  );
};
// frontend/src/components/setup/steps/APIKeysStep.tsx
import React from 'react';
import {
  Stack,
  PasswordInput,
  Button,
  Group,
  Alert,
  Text,
  Anchor,
  Card,
  Badge,
  Loader,
  Switch,
  Grid
} from '@mantine/core';
import {
  IconKey,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconExternalLink,
  IconRobot,
  IconLink
} from '@tabler/icons-react';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const APIKeysStep: React.FC = () => {
  const {
    apiKeysConfig,
    processingConfig,
    claudeTestResult,
    linkpreviewTestResult,
    isTesting,
    updateAPIKeysConfig,
    updateProcessingConfig,
    testClaudeAPI,
    testLinkPreviewAPI
  } = useSetupStore();

  const handleClaudeKeyChange = (value: string) => {
    updateAPIKeysConfig({ claude_api_key: value });
  };

  const handleLinkPreviewKeyChange = (value: string) => {
    updateAPIKeysConfig({ linkpreview_api_key: value });
  };

  const handleLinkEnrichmentToggle = (enabled: boolean) => {
    updateProcessingConfig({ enable_link_enrichment: enabled });
  };

  const getTestStatusBadge = (testResult: any, isRequired: boolean = true) => {
    if (isTesting) {
      return <Badge color="blue" leftSection={<Loader size="xs" />}>Testing...</Badge>;
    }

    if (!testResult) {
      return <Badge color="gray">{isRequired ? 'Not Tested' : 'Optional'}</Badge>;
    }

    return testResult.success ? (
      <Badge color="green" leftSection={<IconCheck size="0.7rem" />}>Valid</Badge>  // Smaller icon
    ) : (
      <Badge color="red" leftSection={<IconX size="0.7rem" />}>Failed</Badge>        // Smaller icon
    );
  };

  return (
    <Stack gap="lg">
      <div>
        <Text size="xl" fw={600} mb="xs">API Keys</Text>
        <Text c="dimmed" size="sm">
          Configure your API keys for AI processing and link enrichment
        </Text>
      </div>

      {/* Claude API Key Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md"> {/* ✅ FIXED: spacing="md" → gap="md" */}
          <Group justify="space-between">
            <div>
              <Text fw={500}>Claude API (Required)</Text>
              <Text size="sm" c="dimmed">Powers AI summarization</Text>
            </div>
            <Badge color="blue" leftSection={<IconRobot size="0.8rem" />}>Required</Badge>
          </Group>

          <PasswordInput
            label="Claude API Key"
            placeholder="sk-ant-api03-..."
            value={apiKeysConfig.claude_api_key}
            onChange={(e) => handleClaudeKeyChange(e.target.value)}
            leftSection={<IconKey size="1rem" />}
            description={
              <Text size="xs" c="dimmed">
                Get your API key from{' '}
                <Anchor
                  href="https://console.anthropic.com/"
                  target="_blank"
                  size="xs"
                >
                  Anthropic Console <IconExternalLink size="0.8rem" style={{ display: 'inline' }} />
                </Anchor>
              </Text>
            }
            required
          />

          <Group justify="space-between" align="center">
            <Text size="sm" fw={500}>API Status</Text>
            {getTestStatusBadge(claudeTestResult, true)}
          </Group>

          {claudeTestResult && !claudeTestResult.success && (
            <Alert
              icon={<IconX size="1rem" />}
              title="API Test Failed"
              color="red"
              variant="light"
            >
              <Text size="sm">
                {claudeTestResult.error || 'Please check your API key and try again.'}
              </Text>
            </Alert>
          )}

          {claudeTestResult && claudeTestResult.success && (
            <Alert icon={<IconCheck size="1rem" />} title="Test Successful" color="green" variant="light">
              Claude API key is working correctly!
            </Alert>
          )}

          <Group justify="center">
            <Button
              onClick={testClaudeAPI}
              loading={isTesting}
              disabled={!apiKeysConfig.claude_api_key}
              variant="light"
              leftSection={<IconCheck size="1rem" />}
            >
              Test Claude API
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Link Enrichment Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Link Enrichment</Text>
              <Text size="sm" c="dimmed">Enhanced link previews and metadata</Text>
            </div>
            <Badge color="gray" leftSection={<IconLink size="0.8rem" />}>Optional</Badge>
          </Group>

          <Switch
            label="Enable Link Enrichment"
            description="Fetch titles, descriptions, and images for extracted links"
            checked={processingConfig.enable_link_enrichment}
            onChange={(e) => handleLinkEnrichmentToggle(e.currentTarget.checked)}
          />

          {processingConfig.enable_link_enrichment && (
            <>
              <PasswordInput
                label="LinkPreview API Key"
                placeholder="your-linkpreview-key"
                value={apiKeysConfig.linkpreview_api_key || ''}
                onChange={(e) => handleLinkPreviewKeyChange(e.target.value)}
                leftSection={<IconKey size="1rem" />}
                description={
                  <Text size="xs" c="dimmed">
                    Get your API key from{' '}
                    <Anchor
                      href="https://www.linkpreview.net/"
                      target="_blank"
                      size="xs"
                    >
                      LinkPreview.net <IconExternalLink size="0.8rem" style={{ display: 'inline' }} />
                    </Anchor>
                    {' '}(Free tier: 1,000 requests/month)
                  </Text>
                }
              />

              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>API Status</Text>
                {getTestStatusBadge(linkpreviewTestResult, false)}
              </Group>

              {linkpreviewTestResult && !linkpreviewTestResult.success && (
                <Alert
                  icon={<IconX size="1rem" />}
                  title="LinkPreview Test Failed"
                  color="red"
                  variant="light"
                >
                  <Text size="sm">
                    {linkpreviewTestResult.error || 'Please check your LinkPreview API key.'}
                  </Text>
                </Alert>
              )}

              {linkpreviewTestResult && linkpreviewTestResult.success && (
                <Alert icon={<IconCheck size="1rem" />} title="Test Successful" color="green" variant="light">
                  LinkPreview API key is working correctly!
                </Alert>
              )}

              <Group justify="center">
                <Button
                  onClick={testLinkPreviewAPI}
                  loading={isTesting}
                  disabled={!apiKeysConfig.linkpreview_api_key}
                  variant="light"
                  leftSection={<IconCheck size="1rem" />}
                >
                  Test LinkPreview API
                </Button>
              </Group>
            </>
          )}

          {!processingConfig.enable_link_enrichment && (
            <Alert icon={<IconInfoCircle size="1rem" />} color="gray" variant="light">
              <Text size="sm">
                Link enrichment is disabled. Links will be extracted but won't have
                enhanced titles or descriptions.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="API Cost"
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
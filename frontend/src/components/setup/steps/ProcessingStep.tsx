// frontend/src/components/setup/steps/ProcessingStep.tsx
import React from 'react';
import {
  Stack,
  NumberInput,
  Select,
  Switch,
  Card,
  Text,
  Alert,
  Grid,
  Slider,
  Group,
  Badge
} from '@mantine/core';
import {
  IconInfoCircle,
  IconSettings,
  IconRobot,
  IconLink,
  IconClock
} from '@tabler/icons-react';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const ProcessingStep: React.FC = () => {
  const {
    processingConfig,
    updateProcessingConfig
  } = useSetupStore();

  const claudeModels = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended - Recent)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Stable)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5 (Fast & Economical)' }
];

  return (
    <Stack gap="lg"> {/* ✅ FIXED: spacing="lg" → gap="lg" */}
      <div>
        <Text size="xl" fw={600} mb="xs">Processing Configuration</Text>
        <Text c="dimmed" size="sm">
          Configure how your content will be processed and summarized.
        </Text>
      </div>

      {/* General Processing Settings */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group>
            <IconSettings size="1.2rem" />
            <Text fw={500}>General Settings</Text>
          </Group>
        </Card.Section>

        <Stack gap="md" mt="md">
          <NumberInput
            label="Maximum Articles per Run"
            description="Limit the number of articles processed in a single run to control costs and time"
            value={processingConfig.max_articles_per_run}
            onChange={(value) => updateProcessingConfig({
              max_articles_per_run: typeof value === 'number' ? value : (parseInt(value as string) || 20)
            })}
            min={1}
            max={100}
            stepHoldDelay={500}
            stepHoldInterval={100}
          />

          <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
            <Text size="sm">
              <Text fw={500} component="span">Recommended:</Text> Start with 20 articles per run.
              This typically processes a week's worth of newsletters and takes 5-10 minutes.
            </Text>
          </Alert>
        </Stack>
      </Card>

      {/* AI Model Selection */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group>
            <IconRobot size="1.2rem" />
            <Text fw={500}>AI Model Configuration</Text>
          </Group>
        </Card.Section>

        <Stack gap="md" mt="md">
          <Select
            label="Claude Model"
            description="Select the AI model for content summarization"
            data={claudeModels}
            value={processingConfig.claude_model}
            onChange={(value) => updateProcessingConfig({
              claude_model: value || claudeModels[0].value
            })}
            allowDeselect={false}
          />

          <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
            <Grid>
              <Grid.Col span={4}>
                <Text size="sm" fw={500}>Claude 3.5 Sonnet</Text>
                <Text size="sm" c="dimmed">Best quality, moderate cost</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="sm" fw={500}>Claude 3 Sonnet</Text>
                <Text size="sm" c="dimmed">Good quality, moderate cost</Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="sm" fw={500}>Claude 3 Haiku</Text>
                <Text size="sm" c="dimmed">Fast processing, lowest cost</Text>
              </Grid.Col>
            </Grid>
          </Alert>
        </Stack>
      </Card>

      {/* Link Enrichment Settings */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group>
            <IconLink size="1.2rem" />
            <Text fw={500}>Link Enrichment</Text>
            <Badge color="yellow" size="sm">Optional</Badge>
          </Group>
        </Card.Section>

        <Stack gap="md" mt="md">
          <Switch
            label="Enable Link Enrichment"
            description="Fetch titles and descriptions for extracted links using LinkPreview API"
            checked={processingConfig.enable_link_enrichment}
            onChange={(event) => updateProcessingConfig({
              enable_link_enrichment: event.currentTarget.checked
            })}
          />

          {processingConfig.enable_link_enrichment && (
            <div>
              <Text size="sm" fw={500} mb="xs">
                Maximum Links to Enrich per Article
              </Text>
              <Slider
                value={processingConfig.max_links_to_enrich}
                onChange={(value) => updateProcessingConfig({
                  max_links_to_enrich: value
                })}
                min={5}
                max={20}
                step={1}
                marks={[
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 15, label: '15' },
                  { value: 20, label: '20' }
                ]}
                mb="md"
              />
              <Text size="xs" c="dimmed">
                Current: {processingConfig.max_links_to_enrich} links per article
              </Text>

              <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light" mt="md">
                <Text size="sm">
                  LinkPreview free tier allows 1,000 requests/month.
                  With {processingConfig.max_links_to_enrich} links per article × {processingConfig.max_articles_per_run} articles = {processingConfig.max_links_to_enrich * processingConfig.max_articles_per_run} API calls per processing run.
                </Text>
              </Alert>
            </div>
          )}

          {!processingConfig.enable_link_enrichment && (
            <Alert icon={<IconInfoCircle size="1rem" />} color="gray" variant="light">
              <Text size="sm">
                Links will still be extracted from content, but won't have enhanced
                titles or descriptions without the LinkPreview API.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Processing Summary */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group>
            <IconClock size="1.2rem" />
            <Text fw={500}>Processing Summary</Text>
          </Group>
        </Card.Section>

        <Grid mt="md">
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>Estimated Processing Time</Text>
            <Text size="sm" c="dimmed">
              {Math.ceil(processingConfig.max_articles_per_run / 4)} - {Math.ceil(processingConfig.max_articles_per_run / 2)} minutes
            </Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>Claude API Calls per Run</Text>
            <Text size="sm" c="dimmed">
              ~{processingConfig.max_articles_per_run} calls
            </Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>LinkPreview API Calls</Text>
            <Text size="sm" c="dimmed">
              {processingConfig.enable_link_enrichment
                ? `~${processingConfig.max_articles_per_run * processingConfig.max_links_to_enrich} calls`
                : 'Disabled'
              }
            </Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" fw={500}>Estimated Cost per Run</Text>
            <Text size="sm" c="dimmed">
              {processingConfig.claude_model.includes('haiku') ? '$0.05 - $0.15' :
               processingConfig.claude_model.includes('sonnet') ? '$0.15 - $0.40' :
               '$0.10 - $0.25'}
            </Text>
          </Grid.Col>
        </Grid>

        <Alert icon={<IconInfoCircle size="1rem" />} color="green" variant="light" mt="md">
          <Text size="sm">
            <Text fw={500} component="span">Ready to process!</Text> Your configuration will process up to {processingConfig.max_articles_per_run} articles using {processingConfig.claude_model.split('-')[2]} model
            {processingConfig.enable_link_enrichment && ` with link enrichment enabled`}.
          </Text>
        </Alert>
      </Card>
    </Stack>
  );
};
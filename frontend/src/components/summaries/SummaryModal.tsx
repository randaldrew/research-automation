// frontend/src/components/summaries/SummaryModal.tsx
import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Divider,
  List,
  ScrollArea,
  Tooltip,
  Card,
  CopyButton
} from '@mantine/core';
import {
  IconStar,
  IconStarFilled,
  IconEye,
  IconEyeOff,
  IconDownload,
  IconShare,
  IconCopy,
  IconCheck,
  IconCalendar,
  IconFileText,
  IconQuestionMark,
  IconBulb
} from '@tabler/icons-react';
import { Summary } from '../../hooks/useSummariesStore';
import { dateUtils } from '../../utils/dateUtils';
import { textUtils } from '../../utils/textUtils';

interface SummaryModalProps {
  summary: Summary | null;
  opened: boolean;
  onClose: () => void;
  onToggleRead?: (summaryId: number) => void;
  onToggleStarred?: (summaryId: number) => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  summary,
  opened,
  onClose,
  onToggleRead,
  onToggleStarred
}) => {
  if (!summary) return null;

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'email':
      case 'newsletter':
        return 'blue';
      case 'podcast':
        return 'green';
      case 'rss':
        return 'orange';
      case 'web':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const handleDownload = () => {
    const content = `# ${summary.title}

**Source:** ${summary.source}  
**Date:** ${summary.date}  
**Type:** ${summary.source_type}  

## Summary

${summary.summary}

${summary.questions && summary.questions.length > 0 ? `
## Questions for Experts

${summary.questions.map(q => `- ${q}`).join('\n')}
` : ''}

${summary.insights && summary.insights.length > 0 ? `
## Key Insights

${summary.insights.map(i => `- ${i}`).join('\n')}
` : ''}

${summary.tags && summary.tags.length > 0 ? `
## Tags

${summary.tags.join(', ')}
` : ''}

---
Generated on ${dateUtils.formatDate(summary.created_at, { includeTime: true })}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${textUtils.slugify(summary.title)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: summary.title,
          text: textUtils.getExcerpt(summary.summary, 200),
          url: window.location.href
        });
      } catch (err) {
        // Fall back to copy link
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      // Fall back to copy link
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm" style={{ width: '100%' }}>
          <IconFileText size="1.2rem" color={`var(--mantine-color-${getSourceTypeColor(summary.source_type)}-6)`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} lineClamp={1}>
              {summary.title}
            </Text>
            <Text size="xs" c="dimmed">
              {summary.source} • {dateUtils.formatDate(summary.date)}
            </Text>
          </div>
        </Group>
      }
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        {/* Header Actions */}
        <Group justify="space-between">
          <Group gap="xs">
            <Badge
              variant="light"
              color={getSourceTypeColor(summary.source_type)}
              size="sm"
            >
              {summary.source_type}
            </Badge>

            {summary.tags && summary.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} size="xs" variant="dot" color="blue">
                {tag}
              </Badge>
            ))}

            {summary.tags && summary.tags.length > 3 && (
              <Badge size="xs" variant="light" color="gray">
                +{summary.tags.length - 3}
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            <Tooltip label={summary.read ? "Mark as unread" : "Mark as read"}>
              <ActionIcon
                variant="light"
                onClick={() => onToggleRead?.(summary.id)}
              >
                {summary.read ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label={summary.starred ? "Remove star" : "Add star"}>
              <ActionIcon
                variant="light"
                color={summary.starred ? "yellow" : "gray"}
                onClick={() => onToggleStarred?.(summary.id)}
              >
                {summary.starred ? <IconStarFilled size="1rem" /> : <IconStar size="1rem" />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Download as Markdown">
              <ActionIcon variant="light" onClick={handleDownload}>
                <IconDownload size="1rem" />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Share">
              <ActionIcon variant="light" onClick={handleShare}>
                <IconShare size="1rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider />

        {/* Summary Content */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={500} size="sm">Summary</Text>
              <CopyButton value={summary.summary}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={copied ? <IconCheck size="0.8rem" /> : <IconCopy size="0.8rem" />}
                    onClick={copy}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>

            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {summary.summary}
            </Text>
          </Stack>
        </Card>

        {/* Questions */}
        {summary.questions && summary.questions.length > 0 && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="sm">
              <Group gap="xs">
                <IconQuestionMark size="1rem" />
                <Text fw={500} size="sm">Questions for Experts</Text>
              </Group>

              <List size="sm" spacing="xs">
                {summary.questions.map((question, index) => (
                  <List.Item key={index}>{question}</List.Item>
                ))}
              </List>
            </Stack>
          </Card>
        )}

        {/* Insights */}
        {summary.insights && summary.insights.length > 0 && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="sm">
              <Group gap="xs">
                <IconBulb size="1rem" />
                <Text fw={500} size="sm">Key Insights</Text>
              </Group>

              <List size="sm" spacing="xs">
                {summary.insights.map((insight, index) => (
                  <List.Item key={index}>{insight}</List.Item>
                ))}
              </List>
            </Stack>
          </Card>
        )}

        {/* All Tags */}
        {summary.tags && summary.tags.length > 0 && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="sm">
              <Text fw={500} size="sm">All Tags</Text>
              <Group gap="xs">
                {summary.tags.map((tag) => (
                  <Badge key={tag} size="sm" variant="light" color="blue">
                    {tag}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Card>
        )}

        {/* Metadata */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={500} size="sm">Metadata</Text>

            <Group gap="md">
              <Group gap="xs">
                <IconCalendar size="0.8rem" />
                <Text size="xs">
                  <Text fw={500} component="span">Published:</Text> {dateUtils.formatDate(summary.date, { includeTime: false })}
                </Text>
              </Group>

              <Group gap="xs">
                <IconFileText size="0.8rem" />
                <Text size="xs">
                  <Text fw={500} component="span">Content:</Text> {textUtils.formatCount(summary.content_length)} characters
                </Text>
              </Group>
            </Group>

            <Group gap="md">
              <Text size="xs">
                <Text fw={500} component="span">Processing:</Text> {summary.chunks_processed} chunks
              </Text>

              <Text size="xs">
                <Text fw={500} component="span">Reading time:</Text> {textUtils.readingTime(summary.summary)}
              </Text>
            </Group>

            <Group gap="md"> {/* ✅ FIXED: spacing="md" → gap="md" */}
              <Text size="xs">
                <Text fw={500} component="span">Created:</Text> {dateUtils.formatDate(summary.created_at, { includeTime: true })}
              </Text>

              <Text size="xs">
                <Text fw={500} component="span">Status:</Text> {summary.read ? 'Read' : 'Unread'} {summary.starred && '• Starred'}
              </Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Modal>
  );
};
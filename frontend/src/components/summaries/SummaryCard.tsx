// frontend/src/components/summaries/SummaryCard.tsx
import React from 'react';
import {
  Card,
  Group,
  Text,
  Badge,
  ActionIcon,
  Stack,
  Collapse,
  Button,
  Divider,
  List,
  Tooltip,
  CopyButton
} from '@mantine/core';
import {
  IconStar,
  IconStarFilled,
  IconEye,
  IconEyeOff,
  IconDownload,        // New download icon
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconCalendar,
  IconFileText,
  IconQuestionMark,
  IconBulb,
  IconCopy,
  IconCheck,
  IconCalendarWeek     // For weekly summary badge
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { Summary } from '../../hooks/useSummariesStore';
import { dateUtils } from '../../utils/dateUtils';
import { textUtils } from '../../utils/textUtils';

interface SummaryCardProps {
  summary: Summary;
  onToggleRead?: (summaryId: number) => void;
  onToggleStarred?: (summaryId: number) => void;
  onView?: (summary: Summary) => void;
  onDownload?: (summaryId: number, filename: string) => void;  // Download handler
  compact?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  onToggleRead,
  onToggleStarred,
  onView,
  onDownload,           // Extract download prop
  compact = false
}) => {
  const [expanded, { toggle: toggleExpanded }] = useDisclosure(false);

  // All existing utility functions
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
      case 'weekly_summary':  // Handle weekly summary type
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getSourceTypeIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'email':
      case 'newsletter':
        return IconFileText;
      case 'podcast':
        return IconFileText;
      case 'weekly_summary':  // Handle weekly summary type
        return IconCalendarWeek;
      default:
        return IconFileText;
    }
  };

  // Download handler function
  const handleDownload = () => {
    const isWeeklySummary = summary.source_type === 'weekly_summary';
    const filename = isWeeklySummary
      ? `Weekly_Summary_${summary.date}.md`
      : `${summary.source.replace(/[^a-zA-Z0-9]/g, '_')}_${summary.date}.md`;

    onDownload?.(summary.id, filename);
  };

  const SourceIcon = getSourceTypeIcon(summary.source_type);

  // Check if this is a weekly summary
  const isWeeklySummary = summary.source_type === 'weekly_summary';

  return (
    <Card
      shadow="sm"
      padding={compact ? "md" : "lg"}
      radius="md"
      withBorder
      style={{
        opacity: summary.read ? 0.8 : 1,
        cursor: onView ? 'pointer' : 'default'
      }}
      onClick={() => !expanded && onView?.(summary)}
    >
      <Stack gap={compact ? "sm" : "md"}>
        {/*  Header section with minor enhancements */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
            <SourceIcon size="1.2rem" color={`var(--mantine-color-${getSourceTypeColor(summary.source_type)}-6)`} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <Text
                fw={600}
                size={compact ? "sm" : "md"}
                lineClamp={2}
                style={{
                  fontWeight: summary.read ? 400 : 600
                }}
              >
                {summary.title}
              </Text>

              <Group gap="xs" mt={2}>
                <Text size="xs" c="dimmed">
                  {summary.source}
                </Text>
                <Text size="xs" c="dimmed">
                  •
                </Text>
                <Group gap={4}>
                  <IconCalendar size="0.7rem" />
                  <Text size="xs" c="dimmed">
                    {dateUtils.formatDate(summary.date, { relative: true })}
                  </Text>
                </Group>
              </Group>
            </div>
          </Group>

          {/* Action buttons with download functionality */}
          <Group gap="xs">
            {/*  Weekly summary badge */}
            {isWeeklySummary && (
              <Badge color="purple" variant="light" size="sm">
                <IconCalendarWeek size="0.8rem" style={{ marginRight: 4 }} />
                Weekly Summary
              </Badge>
            )}

            <Badge
              size="sm"
              variant="light"
              color={getSourceTypeColor(summary.source_type)}
            >
              {summary.source_type}
            </Badge>

            {/* Download button */}
            <Tooltip label="Download as Markdown">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
              >
                <IconDownload size="1rem" />
              </ActionIcon>
            </Tooltip>

            {/* Existing read/unread button */}
            {!isWeeklySummary && (
              <Tooltip label={summary.read ? "Mark as unread" : "Mark as read"}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRead?.(summary.id);
                  }}
                >
                  {summary.read ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
                </ActionIcon>
              </Tooltip>
            )}

            {/*  Existing star button */}
            {!isWeeklySummary && (
              <Tooltip label={summary.starred ? "Remove star" : "Add star"}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={summary.starred ? "yellow" : "gray"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStarred?.(summary.id);
                  }}
                >
                  {summary.starred ? <IconStarFilled size="1rem" /> : <IconStar size="1rem" />}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Summary Preview section */}
        <div>
          <Text
            size="sm"
            c="dimmed"
            lineClamp={expanded ? undefined : (compact ? 2 : 3)}
          >
            {isWeeklySummary
              ? `Aggregated summary of ${summary.chunks_processed} items from the past week`
              : textUtils.getExcerpt(summary.summary, compact ? 150 : 200)
            }
          </Text>

          {summary.summary.length > 200 && (
            <Button
              variant="subtle"
              size="xs"
              leftSection={expanded ? <IconChevronUp size="0.8rem" /> : <IconChevronDown size="0.8rem" />}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
              mt="xs"
            >
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          )}
        </div>

        {/* Tags section */}
        {summary.tags && summary.tags.length > 0 && (
          <Group gap="xs">
            {summary.tags.slice(0, compact ? 3 : 5).map((tag) => (
              <Badge
                key={tag}
                size="xs"
                variant="dot"
                color="blue"
              >
                {tag}
              </Badge>
            ))}
            {summary.tags.length > (compact ? 3 : 5) && (
              <Badge size="xs" variant="light" color="gray">
                +{summary.tags.length - (compact ? 3 : 5)} more
              </Badge>
            )}
          </Group>
        )}

        {/* Expanded Content section */}
        <Collapse in={expanded}>
          <Stack gap="md">
            <Divider />

            {/* Full Summary */}
            <div>
              <Group justify="space-between" mb="xs">
                <Text fw={500} size="sm">
                  Full Summary
                </Text>
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

              <Text size="sm">{summary.summary}</Text>
            </div>

            {/* Questions */}
            {summary.questions && summary.questions.length > 0 && (
              <div>
                <Group gap="xs" mb="xs">
                  <IconQuestionMark size="1rem" />
                  <Text fw={500} size="sm">Questions for Experts</Text>
                </Group>

                <List size="sm" spacing="xs">
                  {summary.questions.map((question, index) => (
                    <List.Item key={index}>{question}</List.Item>
                  ))}
                </List>
              </div>
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

                <Group gap="md">
                  <Text size="xs">
                    <Text fw={500} component="span">Created:</Text> {dateUtils.formatDate(summary.created_at, { includeTime: true })}
                  </Text>

                  <Text size="xs">
                    <Text fw={500} component="span">Status:</Text> {summary.read ? 'Read' : 'Unread'} {summary.starred && '• Starred'}
                  </Text>
                </Group>
              </Stack>
            </Card>

            {/* View Details Button */}
            <Group justify="center">
              <Button
                variant="light"
                leftSection={<IconExternalLink size="0.9rem" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onView?.(summary);
                }}
              >
                View Details
              </Button>
            </Group>
          </Stack>
        </Collapse>

        {/*Footer section */}
        {!expanded && (
          <Group justify="space-between" style={{ fontSize: '12px' }}>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {textUtils.readingTime(summary.summary)}
              </Text>
              <Text size="xs" c="dimmed">
                •
              </Text>
              <Text size="xs" c="dimmed">
                {textUtils.formatCount(summary.content_length)} chars
              </Text>
              {isWeeklySummary && summary.questions && summary.questions.length > 0 && (
                <>
                  <Text size="xs" c="dimmed">•</Text>
                  <Text size="xs" c="dimmed">
                    {summary.questions.length} questions
                  </Text>
                </>
              )}
            </Group>

            <Text size="xs" c="dimmed">
              {dateUtils.formatDate(summary.created_at, { relative: true })}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
};
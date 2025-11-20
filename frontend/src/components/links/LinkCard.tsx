// frontend/src/components/links/LinkCard.tsx
import React from 'react';
import {
  Card,
  Group,
  Text,
  Badge,
  ActionIcon,
  Stack,
  Image,
  Tooltip,
  CopyButton,
  Avatar
} from '@mantine/core';
import {
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconCalendar,
  IconWorld
} from '@tabler/icons-react';
import { Link } from '../../hooks/useLinksStore';
import { dateUtils } from '../../utils/dateUtils';
import { textUtils } from '../../utils/textUtils';

interface LinkCardProps {
  link: Link;
  onVisit?: (link: Link) => void;
  onMarkVisited?: (linkId: number) => void;
  compact?: boolean;
  showSource?: boolean;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
  onVisit,
  onMarkVisited,
  compact = false,
  showSource = true
}) => {
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const getSourceColor = (source: string) => {
    const hash = source.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'pink', 'grape'];
    return colors[Math.abs(hash) % colors.length];
  };

  const domain = getDomain(link.url);
  const faviconUrl = getFaviconUrl(link.url);
  const tags = link.tags || [];

  return (
    <Card
      shadow="sm"
      padding={compact ? "sm" : "md"}
      radius="md"
      withBorder
      style={{
        opacity: link.visited ? 0.7 : 1,
        cursor: 'pointer',
        transition: 'transform 0.1s ease'
      }}
      onClick={() => onVisit?.(link)}
    >
      <Stack gap={compact ? "xs" : "sm"}>
        {/* Header with favicon and actions */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
            {faviconUrl ? (
              <Avatar src={faviconUrl} size="sm" radius="sm" />
            ) : (
              <Avatar size="sm" radius="sm" color="gray">
                <IconWorld size="1rem" />
              </Avatar>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <Text
                fw={600}
                size={compact ? "sm" : "md"}
                lineClamp={compact ? 1 : 2}
                style={{
                  fontWeight: link.visited ? 400 : 600
                }}
              >
                {link.title || 'Untitled Link'}
              </Text>

              <Group gap="xs" mt={2}>
                <Text size="xs" c="dimmed">
                  {domain}
                </Text>
                {showSource && (
                  <>
                    <Text size="xs" c="dimmed">•</Text>
                    <Text size="xs" c="dimmed">
                      from {link.source}
                    </Text>
                  </>
                )}
                <Text size="xs" c="dimmed">•</Text>
                <Group gap={2}>
                  <IconCalendar size="0.7rem" />
                  <Text size="xs" c="dimmed">
                    {dateUtils.formatDate(link.date, { relative: true })}
                  </Text>
                </Group>
              </Group>
            </div>
          </Group>

          <Group gap="xs">
            <Tooltip label={link.visited ? "Mark as unvisited" : "Mark as visited"}>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkVisited?.(link.id);
                }}
              >
                {link.visited ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
              </ActionIcon>
            </Tooltip>

            <CopyButton value={link.url}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copy();
                    }}
                  >
                    {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>

            <Tooltip label="Open in new tab">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link.url, '_blank', 'noopener,noreferrer');
                }}
              >
                <IconExternalLink size="1rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Description */}
        {!compact && link.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {textUtils.truncate(link.description, 200)}
          </Text>
        )}

       {/* Image preview */}
        {!compact && link.image_url && (
          <Image
            src={link.image_url}
            height={120}
            radius="sm"
            fit="cover"
          />
        )}

        {/* Tags and metadata */}
        {!compact && (
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" style={{ flex: 1, overflow: 'hidden' }}>
              {tags.slice(0, 3).map((tag: string) => (
                <Badge
                  key={tag}
                  size="xs"
                  variant="light"
                  color={getSourceColor(tag)}
                  style={{
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge size="xs" variant="outline" c="dimmed">
                  +{tags.length - 3}
                </Badge>
              )}
            </Group>

            <Group gap="xs">
              {link.enriched && (
                <Badge size="xs" color="green" variant="dot">
                  Enriched
                </Badge>
              )}
              {showSource && (
                <Badge
                  size="xs"
                  color={getSourceColor(link.source)}
                  variant="light"
                >
                  {link.source}
                </Badge>
              )}
            </Group>
          </Group>
        )}
      </Stack>
    </Card>
  );
};
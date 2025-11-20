// frontend/src/components/common/EmptyStates.tsx
import React, { ReactNode } from 'react';
import {
  Stack,
  Text,
  Button,
  Card,
  Center,
  Group,
  ThemeIcon,
  Box
} from '@mantine/core';
import {
  IconFileText,
  IconLink,
  IconSearch,
  IconRss,
  IconBrain,
  IconSettings,
  IconRefresh
} from '@tabler/icons-react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'filled' | 'light' | 'outline';
    color?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'filled' | 'light' | 'outline';
  };
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false
}) => {
  const content = (
    <Stack gap={compact ? "sm" : "lg"} align="center">
      <ThemeIcon
        size={compact ? 48 : 64}
        radius="xl"
        variant="light"
        color="gray"
      >
        {icon}
      </ThemeIcon>

      <Stack gap={compact ? "xs" : "sm"} align="center">
        <Text
          size={compact ? "md" : "lg"}
          fw={600}
          ta="center"
        >
          {title}
        </Text>

        <Text
          size={compact ? "sm" : "md"}
          c="dimmed"
          ta="center"
          maw={compact ? 300 : 400}
        >
          {description}
        </Text>
      </Stack>

      {(action || secondaryAction) && (
        <Group gap="sm">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'filled'}
              color={action.color}
              size={compact ? "sm" : "md"}
            >
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || 'light'}
              size={compact ? "sm" : "md"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );

  if (compact) {
    return <Box py={compact ? "md" : "xl"}>{content}</Box>;
  }

  return (
    <Card shadow="sm" padding="xl" radius="md" withBorder>
      <Center py="xl">
        {content}
      </Center>
    </Card>
  );
};

// Specific empty states for different content types
export const NoSummariesState: React.FC<{ onStartProcessing?: () => void }> = ({
  onStartProcessing
}) => (
  <EmptyState
    icon={<IconFileText size="2rem" />}
    title="No summaries yet"
    description="You haven't processed any newsletters yet. Start your first processing run to generate AI-powered summaries of your content."
    action={onStartProcessing ? {
      label: "Start Processing",
      onClick: onStartProcessing,
      color: "blue"
    } : undefined}
    secondaryAction={{
      label: "Go to Dashboard",
      onClick: () => window.location.href = '/dashboard'
    }}
  />
);

export const NoLinksState: React.FC<{ onStartProcessing?: () => void }> = ({
  onStartProcessing
}) => (
  <EmptyState
    icon={<IconLink size="2rem" />}
    title="No links found"
    description="No links have been extracted yet. Process some newsletters to build your link library with intelligent link extraction."
    action={onStartProcessing ? {
      label: "Start Processing",
      onClick: onStartProcessing,
      color: "blue"
    } : undefined}
    secondaryAction={{
      label: "Go to Dashboard",
      onClick: () => window.location.href = '/dashboard'
    }}
  />
);

export const NoSearchResultsState: React.FC<{
  searchTerm: string;
  onClearSearch: () => void;
}> = ({ searchTerm, onClearSearch }) => (
  <EmptyState
    icon={<IconSearch size="2rem" />}
    title="No results found"
    description={`No items match your search for "${searchTerm}". Try adjusting your search terms or clearing all filters.`}
    action={{
      label: "Clear Search",
      onClick: onClearSearch,
      variant: "light"
    }}
    compact
  />
);

export const ProcessingInProgressState: React.FC<{ onViewProgress?: () => void }> = ({
  onViewProgress
}) => (
  <EmptyState
    icon={<IconBrain size="2rem" />}
    title="Processing in progress"
    description="Your content is currently being processed. New summaries and links will appear here when processing is complete."
    action={onViewProgress ? {
      label: "View Progress",
      onClick: onViewProgress,
      variant: "light",
      color: "blue"
    } : undefined}
    secondaryAction={{
      label: "Refresh",
      onClick: () => window.location.reload()
    }}
  />
);

export const ConfigurationNeededState: React.FC<{ onSetup?: () => void }> = ({
  onSetup
}) => (
  <EmptyState
    icon={<IconSettings size="2rem" />}
    title="Setup required"
    description="You need to configure your email and RSS settings before you can start processing content. Complete the setup wizard to get started."
    action={onSetup ? {
      label: "Complete Setup",
      onClick: onSetup,
      color: "blue"
    } : {
      label: "Go to Setup",
      onClick: () => window.location.href = '/setup',
      color: "blue"
    }}
  />
);

export const ErrorState: React.FC<{
  error: string;
  onRetry?: () => void;
}> = ({ error, onRetry }) => (
  <EmptyState
    icon={<IconRefresh size="2rem" />}
    title="Something went wrong"
    description={`Failed to load data: ${error}. Please try again or contact support if the problem persists.`}
    action={onRetry ? {
      label: "Try Again",
      onClick: onRetry,
      color: "red"
    } : undefined}
    secondaryAction={{
      label: "Refresh Page",
      onClick: () => window.location.reload()
    }}
  />
);

export const RSSEmptyState: React.FC<{ onAddFeed?: () => void }> = ({
  onAddFeed
}) => (
  <EmptyState
    icon={<IconRss size="2rem" />}
    title="No RSS feeds configured"
    description="Add RSS feeds to automatically process newsletter content and podcast transcripts. Configure your feeds in the settings page."
    action={onAddFeed ? {
      label: "Add RSS Feed",
      onClick: onAddFeed,
      color: "orange"
    } : {
      label: "Go to Settings",
      onClick: () => window.location.href = '/settings',
      color: "orange"
    }}
    secondaryAction={{
      label: "Learn More",
      onClick: () => window.open('/docs/rss-setup', '_blank')
    }}
  />
);
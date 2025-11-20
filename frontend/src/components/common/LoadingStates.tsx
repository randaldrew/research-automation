// frontend/src/components/common/LoadingStates.tsx
import React from 'react';
import {
  Skeleton,
  Card,
  Stack,
  Group,
  Box,
  Center,
  Loader,
  Text
} from '@mantine/core';

// Skeleton loader for summary cards
export const SummaryCardSkeleton: React.FC = () => (
  <Card shadow="sm" padding="lg" radius="md" withBorder>
    <Stack gap="md">
      <Group justify="space-between">
        <Skeleton height={20} width="60%" />
        <Skeleton height={18} width={80} radius="xl" />
      </Group>

      <Group gap="xs">
        <Skeleton height={16} width={100} />
        <Skeleton height={16} width={80} />
      </Group>

      <Skeleton height={16} width="100%" />
      <Skeleton height={16} width="90%" />
      <Skeleton height={16} width="85%" />

      <Group gap="xs" mt="md">
        <Skeleton height={24} width={60} radius="xl" />
        <Skeleton height={24} width={80} radius="xl" />
        <Skeleton height={24} width={70} radius="xl" />
      </Group>
    </Stack>
  </Card>
);

// Skeleton loader for link items
export const LinkItemSkeleton: React.FC = () => (
  <Card shadow="sm" padding="md" radius="md" withBorder>
    <Stack gap="sm">
      <Group justify="space-between">
        <Skeleton height={18} width="70%" />
        <Skeleton height={16} width={60} />
      </Group>

      <Skeleton height={14} width="100%" />
      <Skeleton height={14} width="60%" />

      <Group gap="xs">
        <Skeleton height={20} width={50} radius="xl" />
        <Skeleton height={20} width={70} radius="xl" />
      </Group>
    </Stack>
  </Card>
);

// Skeleton loader for table rows
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} style={{ padding: '12px' }}>
        <Skeleton height={16} width={index === 0 ? '80%' : index === columns - 1 ? '60%' : '100%'} />
      </td>
    ))}
  </tr>
);

// Page-level loading with spinner
export const PageLoader: React.FC<{ message?: string; size?: string }> = ({
  message = 'Loading...',
  size = 'lg'
}) => (
  <Center py="xl" style={{ minHeight: '200px' }}>
    <Stack gap="md" align="center">
      <Loader size={size} />
      <Text c="dimmed" size="sm">{message}</Text>
    </Stack>
  </Center>
);

// Inline loading for buttons and small areas
export const InlineLoader: React.FC<{ size?: string }> = ({ size = 'sm' }) => (
  <Loader size={size} />
);

// Content skeleton for full page loads
export const ContentSkeleton: React.FC<{ type?: 'summaries' | 'links' | 'dashboard' }> = ({
  type = 'summaries'
}) => {
  const renderSkeletons = () => {
    switch (type) {
      case 'summaries':
        return Array.from({ length: 3 }).map((_, index) => (
          <SummaryCardSkeleton key={index} />
        ));

      case 'links':
        return Array.from({ length: 5 }).map((_, index) => (
          <LinkItemSkeleton key={index} />
        ));

      case 'dashboard':
        return (
          <>
            {/* Stats cards skeleton */}
            <Group grow mb="lg">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Skeleton height={14} width="60%" />
                      <Skeleton height={20} width={20} />
                    </Group>
                    <Skeleton height={28} width="40%" />
                    <Skeleton height={12} width="80%" />
                  </Stack>
                </Card>
              ))}
            </Group>

            {/* Main content skeleton */}
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Skeleton height={24} width="30%" />
                  <Skeleton height={32} width={120} />
                </Group>
                <Skeleton height={8} width="100%" />
                <Skeleton height={16} width="100%" />
                <Skeleton height={16} width="90%" />
                <Skeleton height={16} width="85%" />
              </Stack>
            </Card>
          </>
        );

      default:
        return <SummaryCardSkeleton />;
    }
  };

  return (
    <Stack gap="lg">
      {renderSkeletons()}
    </Stack>
  );
};

// Loading overlay for existing content
export const LoadingOverlay: React.FC<{ visible: boolean; message?: string }> = ({
  visible,
  message = 'Loading...'
}) => {
  if (!visible) return null;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        borderRadius: 'inherit'
      }}
    >
      <Stack gap="md" align="center">
        <Loader />
        <Text size="sm" c="dimmed">{message}</Text>
      </Stack>
    </Box>
  );
};
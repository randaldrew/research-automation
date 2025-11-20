// frontend/src/components/layout/DashboardLayout.tsx
import React, { ReactNode } from 'react';
import {
  AppShell,
  Text,
  NavLink,
  Group,
  Badge,
} from '@mantine/core';
import {
  IconDashboard,
  IconFileText,
  IconLink,
  IconSettings,
  IconActivity,
  IconBulb,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProcessingStore } from '../../hooks/useProcessingStore';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    processingState,
    stats,
    isWebSocketConnected,
  } = useProcessingStore();

  const navItems = [
    {
      icon: IconDashboard,
      label: 'Dashboard',
      path: '/dashboard',
      description: 'Overview and processing'
    },
    {
      icon: IconFileText,
      label: 'Summaries',
      path: '/summaries',
      description: 'Generated summaries',
      badge: stats?.total_summaries || 0
    },
    {
      icon: IconBulb,
      label: 'Insights',
      path: '/insights',
      description: 'Key insights',
      badge: stats?.total_insights || 0
    },
    {
      icon: IconLink,
      label: 'Links',
      path: '/links',
      description: 'Extracted links',
      badge: stats?.total_links || 0
    },
    {
      icon: IconSettings,
      label: 'Settings',
      path: '/settings',
      description: 'Configuration'
    }
  ];

  const getProcessingStatusBadge = () => {
    switch (processingState.status) {
      case 'running':
        return <Badge color="blue" variant="filled" size="xs">Running</Badge>;
      case 'completed':
        return <Badge color="green" variant="filled" size="xs">Complete</Badge>;
      case 'error':
        return <Badge color="red" variant="filled" size="xs">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <AppShell
      navbar={{ width: 280, breakpoint: 'sm' }}
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header p="md">
          <Group justify="space-between" h="100%">
              <Group>
                  <IconActivity size="1.5rem" color="blue"/>
                  <Text size="xl" fw={600}>Research Automation</Text>
                  {getProcessingStatusBadge()}
              </Group>
          </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <div style={{ flex: 1 }}>
          <Text size="xs" fw={500} c="dimmed" mb="md" tt="uppercase">
            Navigation
          </Text>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                active={isActive}
                label={item.label}
                description={item.description}
                leftSection={<Icon size="1rem" />}
                rightSection={
                  item.badge !== undefined ? (
                    <Badge size="xs" variant="light" color="blue">
                      {item.badge}
                    </Badge>
                  ) : null
                }
                onClick={() => navigate(item.path)}
                mb="xs"
              />
            );
          })}
        </div>

        <div>
          <Text size="xs" fw={500} c="dimmed" mb="md" tt="uppercase">
            Status
          </Text>

          <Group justify="space-between" mb="xs">
            <Text size="sm">Connection</Text>
            <Badge
              size="xs"
              color={isWebSocketConnected ? 'green' : 'red'}
              variant="light"
            >
              {isWebSocketConnected ? 'Online' : 'Offline'}
            </Badge>
          </Group>

          {stats?.last_run && (
            <Group justify="space-between" mb="xs">
              <Text size="sm">Last Run</Text>
              <Text size="xs" c="dimmed">
                {new Date(stats.last_run).toLocaleDateString()}
              </Text>
            </Group>
          )}

          <Group justify="space-between" mb="xs">
            <Text size="sm">Current Status</Text>
            <Text size="xs" c="dimmed" tt="capitalize">
              {processingState.status}
            </Text>
          </Group>

          {processingState.status === 'running' && (
            <Group justify="space-between" mb="xs">
              <Text size="sm">Progress</Text>
              <Text size="xs" c="dimmed">
                {processingState.progress}/{processingState.total_steps}
              </Text>
            </Group>
          )}
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};
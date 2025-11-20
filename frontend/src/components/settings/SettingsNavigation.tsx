// frontend/src/components/settings/SettingsNavigation.tsx
import React, { useEffect } from 'react';
import {
  Stack,
  NavLink,
  Badge,
  Group,
  Text,
  Divider
} from '@mantine/core';
import {
  IconMail,
  IconKey,
  IconSettings,
  IconDatabase,
  IconPlug,
} from '@tabler/icons-react';
import { useSettingsStore } from '../../hooks/useSettingsStore';
import { useSourcesStore } from '../../hooks/useSourcesStore';

export const SettingsNavigation: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    status,
    hasUnsavedChanges,
    emailTestResult,
    claudeTestResult
  } = useSettingsStore();

  const { sources, loadSources } = useSourcesStore();

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const getStatusBadge = (isConfigured: boolean, testResult?: any) => {
    if (hasUnsavedChanges) {
      return <Badge size="xs" color="orange">Unsaved</Badge>;
    }

    if (testResult) {
      return testResult.success ?
        <Badge size="xs" color="green">✓</Badge> :
        <Badge size="xs" color="red">✗</Badge>;
    }

    if (isConfigured) {
      return <Badge size="xs" color="green">✓</Badge>;
    }

    return <Badge size="xs" color="gray">-</Badge>;
  };

  const navItems = [
    {
      section: 'email' as const,
      label: 'Email Configuration',
      description: 'Gmail and SMTP settings',
      icon: IconMail,
      configured: status?.api_keys_valid.email || false,
      testResult: emailTestResult
    },
    {
      section: 'api' as const,
      label: 'API Keys',
      description: 'Claude and LinkPreview keys',
      icon: IconKey,
      configured: status?.api_keys_valid.claude || false,
      testResult: claudeTestResult
    },
    {
      section: 'sources' as const,
      label: 'Content Sources',
      icon: IconPlug,
      description: 'Manage email, RSS, and web sources',
      configured: Object.keys(sources || {}).length > 0
    },
    {
      section: 'processing' as const,
      label: 'Processing Settings',
      description: 'AI model and limits',
      icon: IconSettings,
      configured: status?.is_configured || false,
      testResult: undefined
    },
    {
      section: 'system' as const,
      label: 'System Settings',
      description: 'Directories and exports',
      icon: IconDatabase,
      configured: status?.is_configured || false,
      testResult: undefined
    }
  ];

  return (
  <Stack gap="md">
    {navItems.map((item) => (
      <NavLink
        key={item.section}
        label={
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500}>
                {item.label}
              </Text>
              <Text size="xs" c="dimmed">
                {item.description}
              </Text>
            </div>
            {getStatusBadge(item.configured ?? false, item.testResult)}
          </Group>
        }
        leftSection={React.createElement(item.icon as any, { size: "1rem" })}
        active={activeSection === item.section}
        onClick={() => item.section && setActiveSection(item.section)}
        variant="light"
      />
    ))}

      <Divider />

      {/* System Status Summary */}
      <div style={{ padding: '12px' }}>
        <Text size="sm" fw={600} mb="xs">
          System Status
        </Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm">Overall Setup</Text>
            <Badge
              size="sm"
              color={status?.is_configured ? 'green' : 'red'}
              variant="light"
            >
              {status?.is_configured ? 'Complete' : 'Incomplete'}
            </Badge>
          </Group>

          {hasUnsavedChanges && (
            <Group justify="space-between">
              <Text size="sm">Changes</Text>
              <Badge size="sm" color="orange" variant="light">
                Unsaved
              </Badge>
            </Group>
          )}

          <Group justify="space-between">
            <Text size="sm">API Status</Text>
            <Group gap="xs">
              {status?.api_keys_valid.claude && (
                <Badge size="xs" color="green">Claude</Badge>
              )}
              {status?.api_keys_valid.email && (
                <Badge size="xs" color="blue">Email</Badge>
              )}
              {status?.api_keys_valid.linkpreview && (
                <Badge size="xs" color="purple">Links</Badge>
              )}
            </Group>
          </Group>
        </Stack>
      </div>
    </Stack>
  );
};
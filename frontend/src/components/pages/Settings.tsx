// frontend/src/components/pages/Settings.tsx
import React, { useEffect } from 'react';
import {
  Container,
  Grid,
  Title,
  Text,
  Button,
  Alert,
  Paper,
  Badge,
  Divider
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconRestore,
  IconAlertTriangle,
  IconInfoCircle,
  IconCheck
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useSettingsStore } from '../../hooks/useSettingsStore';
import { SettingsNavigation } from '../settings/SettingsNavigation';
import {
  EmailSettingsSection,
  APIKeysSettingsSection,
  ProcessingSettingsSection,
  SystemSettingsSection,
  SourcesSettingsSection,
} from '../settings/SettingsSections';
import { PageLoader } from '../common/LoadingStates';

export const Settings: React.FC = () => {
  const {
    status,
    activeSection,
    hasUnsavedChanges,
    isLoading,
    isSaving,
    error,
    loadSettings,
    loadStatus,
    saveSettings,
    discardChanges,
    clearError,
    resetSettings,
  } = useSettingsStore();

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadSettings(),
        loadStatus()
      ]);
    };

    loadData();
  }, [loadSettings, loadStatus]);

  const handleSave = async () => {
    try {
      await saveSettings();
      notifications.show({
        title: 'Settings Saved',
        message: 'Your configuration has been updated successfully',
        color: 'green',
        icon: <IconCheck size="1rem" />
      });
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const handleDiscard = () => {
    modals.openConfirmModal({
      title: 'Discard Changes',
      children: (
        <Text size="sm">
          Are you sure you want to discard all unsaved changes?
        </Text>
      ),
      labels: { confirm: 'Discard', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: discardChanges
    });
  };

  const handleReset = () => {
    modals.openConfirmModal({
      title: 'Reset to Defaults',
      children: (
        <Text size="sm">
          This will reset all settings to their default values. You will need to reconfigure everything.
        </Text>
      ),
      labels: { confirm: 'Reset Settings', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          resetSettings();
          notifications.show({
            title: 'Settings Reset',
            message: 'All settings have been reset to defaults',
            color: 'blue'
          });
        } catch (error) {
          notifications.show({
            title: 'Reset Failed',
            message: 'Failed to reset settings. Please try again.',
            color: 'red'
          });
        }
      }
    });
  };

  if (isLoading) {
    return <PageLoader message="Loading settings..." />;
  }

  return (
    <Container size="xl" py="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div>
          <Title order={1}>Settings</Title>
          <Text c="dimmed" size="lg">
            Configure your research automation system
          </Text>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertTriangle size="1rem" />}
            title="Configuration Error"
            color="red"
            variant="light"
            withCloseButton
            onClose={clearError}
          >
            {error}
          </Alert>
        )}

        {/* Unsaved Changes Sticky Bar */}
        {hasUnsavedChanges && (
          <Alert
            icon={<IconInfoCircle size="1rem" />}
            title="Unsaved Changes"
            color="orange"
            variant="light"
            style={{
              position: 'sticky',
              top: '1rem',
              zIndex: 100
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text size="sm">
                You have unsaved changes. Don't forget to save your configuration.
              </Text>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  size="sm"
                  variant="light"
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  leftSection={<IconDeviceFloppy size="0.9rem" />}
                  onClick={handleSave}
                  loading={isSaving}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Main Settings Grid */}
        <Grid>
          {/* Left Sidebar - Navigation */}
          <Grid.Col span={{ base: 12, md: 3 }}>
            <SettingsNavigation />
          </Grid.Col>

          {/* Right Content Area */}
          <Grid.Col span={{ base: 12, md: 9 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Settings Sections */}
              {activeSection === 'email' && <EmailSettingsSection />}
              {activeSection === 'api' && <APIKeysSettingsSection />}
              {activeSection === 'sources' && <SourcesSettingsSection />}
              {activeSection === 'processing' && <ProcessingSettingsSection />}
              {activeSection === 'system' && <SystemSettingsSection />}

              {/* Action Buttons */}
              <Paper shadow="sm" p="lg" withBorder>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text size="lg" fw={600}>Configuration Status</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                    Current system configuration status
                    </Text>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Button
                      variant="light"
                      leftSection={<IconRestore size="1rem" />}
                      onClick={handleReset}
                    >
                      Reset to Defaults
                    </Button>

                    {!hasUnsavedChanges && status?.is_configured && (
                      <Button
                        leftSection={<IconCheck size="1rem" />}
                        onClick={() => {
                          notifications.show({
                            title: 'Configuration Valid',
                            message: 'Your settings are properly configured',
                            color: 'green'
                          });
                        }}
                      >
                        Configuration OK
                      </Button>
                    )}

                    {hasUnsavedChanges && (
                      <Button
                        leftSection={<IconDeviceFloppy size="1rem" />}
                        onClick={handleSave}
                        loading={isSaving}
                      >
                        Save Changes
                      </Button>
                    )}
                  </div>
                </div>

                <Divider my="md" />

                {/* System Status Indicators */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <Text size="sm" fw={500}>System Status:</Text>

                  <Badge
                    color={status?.is_configured ? 'green' : 'red'}
                    variant="light"
                  >
                    {status?.is_configured ? 'Complete' : 'Incomplete'}
                  </Badge>

                  {hasUnsavedChanges && (
                    <Badge color="orange" variant="light">
                      Unsaved Changes
                    </Badge>
                  )}

                  {status?.api_keys_valid && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {status.api_keys_valid.claude && (
                        <Badge size="xs" color="green">Claude</Badge>
                      )}
                      {status.api_keys_valid.email && (
                        <Badge size="xs" color="blue">Email</Badge>
                      )}
                      {status.api_keys_valid.linkpreview && (
                        <Badge size="xs" color="purple">Links</Badge>
                      )}
                    </div>
                  )}
                </div>
              </Paper>
            </div>
          </Grid.Col>
        </Grid>
      </div>
    </Container>
  );
};
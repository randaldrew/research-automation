// frontend/src/components/sources/EditSourceModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Alert,
  Switch,
  Card,
  Text,
  Loader,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconTestPipe,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSourcesStore, SourceConfig, UpdateSourceRequest } from '../../hooks/useSourcesStore';
import { SourceConfigEditor } from './SourceConfigEditor';

interface EditSourceModalProps {
  opened: boolean;
  onClose: () => void;
  sourceId: string | null;
  source: SourceConfig | null;
}

export const EditSourceModal: React.FC<EditSourceModalProps> = ({
  opened,
  onClose,
  sourceId,
  source,
}) => {
  const [formData, setFormData] = useState<UpdateSourceRequest>({});
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const {
    availablePlugins,
    isSaving,
    isTesting,
    error,
    updateSource,
    testSource,
    clearError,
  } = useSourcesStore();

  const selectedPlugin = availablePlugins.find(p => p.plugin_type === source?.type);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (opened && source) {
      setFormData({
        name: source.name,
        enabled: source.enabled,
        config: source.config,
      });
      setConfigErrors([]);
      setHasChanges(false);
      clearError();
    }
  }, [opened, source, clearError]);

  const handleSave = async () => {
    if (!sourceId) return;

    const success = await updateSource(sourceId, formData);

    if (success) {
      notifications.show({
        title: 'Source Updated',
        message: `Successfully updated ${source?.name}`,
        color: 'green',
        icon: <IconCheck size="1rem" />,
      });
      onClose();
    }
  };

  const handleTest = async () => {
    if (!sourceId) return;
    await testSource(sourceId);
  };

  const handleChange = (field: keyof UpdateSourceRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  if (!source) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Edit Source: ${source.name}`}
      size="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Error"
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        {/* Basic Information */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Text fw={500} size="sm">Basic Information</Text>

            <TextInput
              label="Source Name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <Switch
              label="Enable source"
              description="Whether this source should be active"
              checked={formData.enabled || false}
              onChange={(e) => handleChange('enabled', e.currentTarget.checked)}
            />

            <Group gap="xs">
              <Text size="sm" c="dimmed">Type:</Text>
              <Text size="sm">{selectedPlugin?.name || source.type}</Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" c="dimmed">ID:</Text>
              <Text size="sm">{source.source_id}</Text>
            </Group>
          </Stack>
        </Card>

        {/* Configuration */}
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Text fw={500} size="sm">Configuration</Text>

            {selectedPlugin ? (
              <SourceConfigEditor
                plugin={selectedPlugin}
                config={formData.config || {}}
                onChange={(config, errors) => {
                  handleChange('config', config);
                  setConfigErrors(errors);
                }}
              />
            ) : (
              <Alert color="orange" variant="light">
                Plugin type "{source.type}" is not available.
              </Alert>
            )}
          </Stack>
        </Card>

        {/* Actions */}
        <Group justify="space-between">
          <Button
            leftSection={<IconTestPipe size="1rem" />}
            variant="light"
            onClick={handleTest}
            disabled={isTesting || !source.plugin_available}
            loading={isTesting}
          >
            Test Source
          </Button>

          <Group gap="sm">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>

            <Button
              leftSection={isSaving ? <Loader size="1rem" /> : <IconCheck size="1rem" />}
              onClick={handleSave}
              disabled={!hasChanges || configErrors.length > 0 || isSaving}
              loading={isSaving}
            >
              Save Changes
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
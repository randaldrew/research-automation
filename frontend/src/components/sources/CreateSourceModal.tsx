// frontend/src/components/sources/CreateSourceModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Alert,
  Stepper,
  Switch,
  Text,
  Card,
  Loader,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconTestPipe,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSourcesStore, PluginMetadata, CreateSourceRequest } from '../../hooks/useSourcesStore';
import { SourceConfigEditor } from './SourceConfigEditor';

interface CreateSourceModalProps {
  opened: boolean;
  onClose: () => void;
  availablePlugins: PluginMetadata[];
}

export const CreateSourceModal: React.FC<CreateSourceModalProps> = ({
  opened,
  onClose,
  availablePlugins,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CreateSourceRequest>({
    source_id: '',
    source_type: '',
    name: '',
    enabled: true,
    config: {},
  });
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<any>(null);

  const {
    isCreating,
    isTesting,
    error,
    createSource,
    testSourceConfig,
    clearError,
  } = useSourcesStore();

  const selectedPlugin = availablePlugins.find(p => p.plugin_type === formData.source_type);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (opened) {
      setCurrentStep(0);
      setFormData({
        source_id: '',
        source_type: '',
        name: '',
        enabled: true,
        config: {},
      });
      setConfigErrors([]);
      setTestResult(null);
      clearError();
    }
  }, [opened, clearError]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Basic info
        return formData.source_id.trim() !== '' &&
               formData.source_type !== '' &&
               formData.name.trim() !== '';

      case 1: // Configuration
        return Object.keys(formData.config).length > 0 && configErrors.length === 0;

      case 2: // Test (optional)
        return true;

      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      // Test configuration before finishing
      if (!testResult) {
        await handleTestConfig();
      }
      if (testResult?.success) {
        setCurrentStep(currentStep + 1);
      }
    } else if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const handleTestConfig = async () => {
    if (!selectedPlugin) return;

    const result = await testSourceConfig({
      source_type: formData.source_type,
      config: formData.config,
    });

    setTestResult(result);
  };

  const handleCreate = async () => {
    const success = await createSource(formData);

    if (success) {
      notifications.show({
        title: 'Source Created',
        message: `Successfully created ${formData.name}`,
        color: 'green',
        icon: <IconCheck size="1rem" />,
      });
      onClose();
    }
  };

  const generateSourceId = (name: string, type: string) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${type}_${cleanName}_${Date.now()}`;
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      source_id: name ? generateSourceId(name, prev.source_type) : '',
    }));
  };

  const handleTypeChange = (sourceType: string) => {
    setFormData(prev => ({
      ...prev,
      source_type: sourceType,
      source_id: prev.name ? generateSourceId(prev.name, sourceType) : '',
      config: {},
    }));
    setTestResult(null);
    setConfigErrors([]);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create New Source"
      size="lg"
      closeOnClickOutside={false}
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

        <Stepper active={currentStep} onStepClick={setCurrentStep} allowNextStepsSelect={false}>
          {/* Step 1: Basic Information */}
          <Stepper.Step label="Basic Info" description="Source details">
            <Stack gap="md" mt="md">
              <TextInput
                label="Source Name"
                placeholder="My Email Source"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                description="A friendly name for this source"
              />

              <Select
                label="Source Type"
                placeholder="Select source type"
                value={formData.source_type}
                onChange={(value) => handleTypeChange(value || '')}
                data={availablePlugins.map(plugin => ({
                  value: plugin.plugin_type,
                  label: plugin.name,
                }))}
                required
                description="Type of content source"
              />

              <TextInput
                label="Source ID"
                value={formData.source_id}
                onChange={(e) => setFormData(prev => ({ ...prev, source_id: e.target.value }))}
                required
                description="Unique identifier (auto-generated)"
              />

              <Switch
                label="Enable source"
                description="Whether this source should be active"
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.currentTarget.checked }))}
              />
            </Stack>
          </Stepper.Step>

          {/* Step 2: Configuration */}
          <Stepper.Step label="Configuration" description="Source settings">
            <Stack gap="md" mt="md">
              {selectedPlugin ? (
                <SourceConfigEditor
                  plugin={selectedPlugin}
                  config={formData.config}
                  onChange={(config, errors) => {
                    setFormData(prev => ({ ...prev, config }));
                    setConfigErrors(errors);
                  }}
                />
              ) : (
                <Alert color="blue" variant="light">
                  Please select a source type first.
                </Alert>
              )}
            </Stack>
          </Stepper.Step>

          {/* Step 3: Test */}
          <Stepper.Step label="Test" description="Verify configuration">
            <Stack gap="md" mt="md">
              <Text size="sm" c="dimmed">
                Test your configuration to make sure it works before creating the source.
              </Text>

              <Group gap="md">
                <Button
                  leftSection={<IconTestPipe size="1rem" />}
                  onClick={handleTestConfig}
                  disabled={isTesting || !selectedPlugin}
                  loading={isTesting}
                >
                  Test Configuration
                </Button>
              </Group>

              {testResult && (
                <Alert
                  icon={testResult.success ? <IconCheck size="1rem" /> : <IconAlertCircle size="1rem" />}
                  title={testResult.success ? 'Test Successful' : 'Test Failed'}
                  color={testResult.success ? 'green' : 'red'}
                  variant="light"
                >
                  {testResult.success
                    ? 'Configuration is valid and connection successful'
                    : testResult.error || 'Test failed'
                  }
                </Alert>
              )}
            </Stack>
          </Stepper.Step>

          {/* Step 4: Review */}
          <Stepper.Step label="Review" description="Confirm and create">
            <Stack gap="md" mt="md">
              <Text size="sm" c="dimmed">
                Review your source configuration and click "Create Source" to finish.
              </Text>

              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>Name:</Text>
                    <Text>{formData.name}</Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Type:</Text>
                    <Text>{selectedPlugin?.name || formData.source_type}</Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>ID:</Text>
                    <Text size="sm" c="dimmed">{formData.source_id}</Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Status:</Text>
                    <Text color={formData.enabled ? 'green' : 'gray'}>
                      {formData.enabled ? 'Enabled' : 'Disabled'}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text fw={500}>Test:</Text>
                    <Text color={testResult?.success ? 'green' : 'orange'}>
                      {testResult?.success ? 'Passed' : 'Not tested'}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Stepper.Step>
        </Stepper>

        {/* Navigation */}
        <Group justify="space-between" mt="xl">
          <Button
            variant="light"
            onClick={currentStep === 0 ? onClose : handleBack}
          >
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!validateStep(currentStep)}
            >
              Next
            </Button>
          ) : (
            <Button
              leftSection={isCreating ? <Loader size="1rem" /> : <IconCheck size="1rem" />}
              onClick={handleCreate}
              disabled={isCreating}
              loading={isCreating}
            >
              Create Source
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
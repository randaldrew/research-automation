// frontend/src/components/sources/SourceTestModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Button,
  Group,
  Alert,
  Text,
  Code,
  Card,
} from '@mantine/core';
import {
  IconCheck,
  IconTestPipe,
  IconX,
} from '@tabler/icons-react';
import { useSourcesStore, SourceConfig } from '../../hooks/useSourcesStore';

interface SourceTestModalProps {
  opened: boolean;
  onClose: () => void;
  sourceId: string | null;
  source: SourceConfig | null;
}

export const SourceTestModal: React.FC<SourceTestModalProps> = ({
  opened,
  onClose,
  sourceId,
  source,
}) => {
  const [testResult, setTestResult] = useState<any>(null);

  const {
    isTesting,
    testResults,
    testSource,
  } = useSourcesStore();

  useEffect(() => {
    if (opened && sourceId) {
      // Check if we have cached results
      if (testResults[sourceId]) {
        setTestResult(testResults[sourceId]);
      } else {
        setTestResult(null);
      }
    }
  }, [opened, sourceId, testResults]);

  const handleTest = async () => {
    if (!sourceId) return;
    const result = await testSource(sourceId);
    setTestResult(result);
  };

  if (!source) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Test Source: ${source.name}`}
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Test the connection and configuration for this source.
        </Text>

        {/* Source Info */}
        <Card shadow="sm" padding="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" fw={500}>Type:</Text>
            <Text size="sm">{source.type}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" fw={500}>Status:</Text>
            <Text size="sm" color={source.enabled ? 'green' : 'gray'}>
              {source.enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </Group>
        </Card>

        {/* Test Button */}
        <Button
          leftSection={<IconTestPipe size="1rem" />}
          onClick={handleTest}
          disabled={isTesting || !source.plugin_available}
          loading={isTesting}
          fullWidth
        >
          {isTesting ? 'Testing...' : 'Run Test'}
        </Button>

        {/* Test Results */}
        {testResult && (
          <Alert
            icon={testResult.success ? <IconCheck size="1rem" /> : <IconX size="1rem" />}
            title={testResult.success ? 'Test Successful' : 'Test Failed'}
            color={testResult.success ? 'green' : 'red'}
            variant="light"
          >
            <Stack gap="xs">
              <Text size="sm">
                {testResult.success
                  ? 'Source is working correctly'
                  : testResult.error || 'Test failed'
                }
              </Text>

              {testResult.details && (
                <Code block>
                  {JSON.stringify(testResult.details, null, 2)}
                </Code>
              )}
            </Stack>
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
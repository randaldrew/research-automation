// frontend/src/components/sources/SourceConfigEditor.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack,
  TextInput,
  NumberInput,
  Select,
  Switch,
  Textarea,
  JsonInput,
  Group,
  Text,
  Alert,
  Card,
  Accordion,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { PluginMetadata } from '../../hooks/useSourcesStore';

interface SourceConfigEditorProps {
  plugin: PluginMetadata;
  config: Record<string, any>;
  onChange: (config: Record<string, any>, errors: string[]) => void;
}

export const SourceConfigEditor: React.FC<SourceConfigEditorProps> = ({
  plugin,
  config,
  onChange,
}) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    // Initialize config with default values
    const schema = plugin.config_schema;
    const schemaProperties = schema.properties || {};

    const configWithDefaults = { ...localConfig };
    let hasDefaults = false;

    Object.entries(schemaProperties).forEach(([key, field]: [string, any]) => {
      if (field.default !== undefined && configWithDefaults[key] === undefined) {
        configWithDefaults[key] = field.default;
        hasDefaults = true;
      }
    });

    if (hasDefaults) {
      setLocalConfig(configWithDefaults);
      const validationErrors = validateConfig(configWithDefaults);
      setErrors(validationErrors);
      onChange(configWithDefaults, validationErrors);
    }
  }, [plugin.config_schema]); // Run when plugin changes

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);

    // Validate the new configuration
    const validationErrors = validateConfig(newConfig);
    setErrors(validationErrors);

    onChange(newConfig, validationErrors);
  };

  const validateConfig = (configToValidate: Record<string, any>): string[] => {
    const validationErrors: string[] = [];
    const schema = plugin.config_schema;

    // Check for required fields
    Object.entries(schema).forEach(([key, field]: [string, any]) => {
      if (field.required && (!configToValidate[key] || configToValidate[key] === '')) {
        validationErrors.push(`${field.description || key} is required`);
      }

      // Type validation
      if (configToValidate[key] !== undefined) {
        const value = configToValidate[key];

        switch (field.type) {
          case 'email':
            if (value && !isValidEmail(value)) {
              validationErrors.push(`${field.description || key} must be a valid email address`);
            }
            break;

          case 'url':
            if (value && !isValidUrl(value)) {
              validationErrors.push(`${field.description || key} must be a valid URL`);
            }
            break;

          case 'integer':
            if (value && (!Number.isInteger(Number(value)) || isNaN(Number(value)))) {
              validationErrors.push(`${field.description || key} must be a valid number`);
            }

            if (field.min && Number(value) < field.min) {
              validationErrors.push(`${field.description || key} must be at least ${field.min}`);
            }

            if (field.max && Number(value) > field.max) {
              validationErrors.push(`${field.description || key} must be at most ${field.max}`);
            }
            break;
        }
      }
    });

    return validationErrors;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const renderField = (key: string, field: any) => {
    const value = localConfig[key] || field.default || '';
    const hasError = errors.some(error => error.includes(field.description || key));

    switch (field.type) {
      case 'string':
      case 'email':
        return (
          <TextInput
            key={key}
            label={field.description || key}
            placeholder={field.example || field.placeholder}
            value={value}
            onChange={(e) => updateConfig(key, e.target.value)}
            required={field.required}
            error={hasError}
            description={field.description !== (field.description || key) ? field.description : undefined}
          />
        );

      case 'password':
        return (
          <TextInput
            key={key}
            type="password"
            label={field.description || key}
            placeholder={field.example || field.placeholder}
            value={value}
            onChange={(e) => updateConfig(key, e.target.value)}
            required={field.required}
            error={hasError}
            description={field.sensitive ? 'This field contains sensitive information' : undefined}
          />
        );

      case 'url':
        return (
          <TextInput
            key={key}
            label={field.description || key}
            placeholder={field.example || 'https://example.com'}
            value={value}
            onChange={(e) => updateConfig(key, e.target.value)}
            required={field.required}
            error={hasError}
            description={field.description !== (field.description || key) ? field.description : undefined}
          />
        );

      case 'integer':
        return (
          <NumberInput
            key={key}
            label={field.description || key}
            placeholder={field.example?.toString() || field.placeholder}
            value={Number(value) || field.default}
            onChange={(val) => updateConfig(key, val)}
            required={field.required}
            min={field.min}
            max={field.max}
            error={hasError}
          />
        );

      case 'boolean':
        return (
          <Switch
            key={key}
            label={field.description || key}
            checked={Boolean(value)}
            onChange={(e) => updateConfig(key, e.currentTarget.checked)}
            description={field.description !== (field.description || key) ? field.description : undefined}
          />
        );

      case 'select':
        return (
          <Select
            key={key}
            label={field.description || key}
            placeholder={field.placeholder || 'Select option'}
            value={value}
            onChange={(val) => updateConfig(key, val)}
            data={field.options || []}
            required={field.required}
            error={hasError}
          />
        );

      case 'textarea':
        return (
          <Textarea
            key={key}
            label={field.description || key}
            placeholder={field.example || field.placeholder}
            value={value}
            onChange={(e) => updateConfig(key, e.target.value)}
            required={field.required}
            rows={field.rows || 3}
            error={hasError}
          />
        );

      case 'object':
        return (
          <JsonInput
            key={key}
            label={field.description || key}
            placeholder={JSON.stringify(field.example || {}, null, 2)}
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(val) => {
              try {
                const parsed = JSON.parse(val);
                updateConfig(key, parsed);
              } catch {
                updateConfig(key, val);
              }
            }}
            required={field.required}
            validationError="Invalid JSON format"
            formatOnBlur
            autosize
            minRows={3}
            maxRows={10}
          />
        );

      default:
        return (
          <TextInput
            key={key}
            label={field.description || key}
            placeholder={field.example || field.placeholder}
            value={value}
            onChange={(e) => updateConfig(key, e.target.value)}
            required={field.required}
            error={hasError}
          />
        );
    }
  };

  const schema = plugin.config_schema;
  const schemaProperties = schema.properties || {};
  const schemaEntries = Object.entries(schemaProperties);
  const requiredFieldNames = schema.required || [];

  // Separate required and optional fields
  const requiredFields = schemaEntries.filter(([key, _field]: [string, any]) =>
    requiredFieldNames.includes(key)
  );
  const optionalFields = schemaEntries.filter(([key, _field]: [string, any]) =>
    !requiredFieldNames.includes(key)
  );

  return (
    <Stack gap="md">
      {/* Plugin Description */}
      <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
        <Text size="sm">
          <strong>{plugin.name}:</strong> {plugin.description}
        </Text>
      </Alert>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert icon={<IconAlertTriangle size="1rem" />} color="red" variant="light">
          <Text size="sm" fw={500} mb="xs">Configuration Issues:</Text>
          <Stack gap="2px">
            {errors.map((error, index) => (
              <Text key={index} size="sm">• {error}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Required Fields */}
      {requiredFields.length > 0 && (
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <Text fw={500} size="sm">Required Configuration</Text>
              <Text size="xs" c="dimmed">({requiredFields.length} fields)</Text>
            </Group>

            {requiredFields.map(([key, field]) => renderField(key, field))}
          </Stack>
        </Card>
      )}

      {/* Optional Fields */}
      {optionalFields.length > 0 && (
        <Accordion variant="contained">
          <Accordion.Item value="optional">
            <Accordion.Control>
              <Group gap="xs">
                <Text fw={500} size="sm">Optional Configuration</Text>
                <Text size="xs" c="dimmed">({optionalFields.length} fields)</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {optionalFields.map(([key, field]) => renderField(key, field))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      {/* Raw JSON Editor (for advanced users) */}
      <Accordion variant="contained">
        <Accordion.Item value="advanced">
          <Accordion.Control>
            <Text fw={500} size="sm">Advanced: Raw JSON</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <JsonInput
              label="Raw Configuration"
              description="Edit the raw JSON configuration directly (advanced users only)"
              value={JSON.stringify(localConfig, null, 2)}
              onChange={(val) => {
                try {
                  const parsed = JSON.parse(val);
                  setLocalConfig(parsed);
                  const validationErrors = validateConfig(parsed);
                  setErrors(validationErrors);
                  onChange(parsed, validationErrors);
                } catch (error) {
                  // Invalid JSON, don't update
                }
              }}
              validationError="Invalid JSON format"
              formatOnBlur
              autosize
              minRows={5}
              maxRows={15}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Current Config Summary */}
      {Object.keys(localConfig).length > 0 && (
        <Card shadow="sm" padding="sm" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Text size="xs" c="dimmed" mb="xs">Current Configuration Summary:</Text>
          <Group gap="xs" wrap="wrap">
            {Object.entries(localConfig).map(([key, value]) => (
              <Text key={key} size="xs" c="dimmed">
                <strong>{key}:</strong> {
                  typeof value === 'object'
                    ? '[object]'
                    : String(value).substring(0, 20) + (String(value).length > 20 ? '...' : '')
                }
              </Text>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
  );
};
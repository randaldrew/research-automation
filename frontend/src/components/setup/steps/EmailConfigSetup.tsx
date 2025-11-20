// frontend/src/components/setup/steps/EmailConfigSetup.tsx
import React from 'react';
import {
  Stack,
  TextInput,
  PasswordInput,
  NumberInput,
  Button,
  Group,
  Alert,
  Text,
  Anchor,
  Card,
  Grid,
  Badge,
  Loader
} from '@mantine/core';
import {
  IconMail,
  IconServer,
  IconKey,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconExternalLink
} from '@tabler/icons-react';
import { useSetupStore } from '../../../hooks/useSetupStore';

export const EmailConfigStep: React.FC = () => {
  const {
    emailConfig,
    emailTestResult,
    isTesting,
    updateEmailConfig,
    testEmailConfig
  } = useSetupStore();

  const handleInputChange = (field: string) => (value: string | number) => {
    updateEmailConfig({ [field]: value });
  };

  const getTestStatusBadge = () => {
    if (isTesting) {
      return <Badge color="blue" leftSection={<Loader size="xs" />}>Testing...</Badge>;
    }

    if (!emailTestResult) {
      return <Badge color="gray">Not Tested</Badge>;
    }

    return emailTestResult.success ? (
      <Badge color="green" leftSection={<IconCheck size="0.8rem" />}>Valid</Badge>
    ) : (
      <Badge color="red" leftSection={<IconX size="0.8rem" />}>Failed</Badge>
    );
  };

  return (
    <Stack gap="lg">
      <div>
        <Text size="xl" fw={600} mb="xs">Email Configuration</Text>
        <Text c="dimmed" size="sm">
          Configure your Gmail account to automatically fetch newsletters.
          We recommend creating a dedicated Gmail account for newsletters.
        </Text>
      </div>

      <Alert
        icon={<IconInfoCircle size="1rem" />}
        title="Setup Requirements"
        color="blue"
        variant="light"
      >
        <Text size="sm">
          You'll need Gmail with 2-Factor Authentication enabled and an App Password.{' '}
          <Anchor
            href="https://support.google.com/accounts/answer/185833"
            target="_blank"
            size="sm"
          >
            Learn how to create an App Password <IconExternalLink size="0.8rem" style={{ display: 'inline' }} />
          </Anchor>
        </Text>
      </Alert>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={500}>Gmail Configuration</Text>
            {getTestStatusBadge()}
          </Group>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Gmail Address"
                value={emailConfig.username}
                onChange={(e) => handleInputChange('username')(e.target.value)}
                placeholder="your-newsletters@gmail.com"
                leftSection={<IconMail size="1rem" />}
                description="Your Gmail account for newsletters"
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Notification Email"
                value={emailConfig.notification_email}
                onChange={(e) => handleInputChange('notification_email')(e.target.value)}
                placeholder="your-main@gmail.com"
                leftSection={<IconMail size="1rem" />}
                description="Where to send processing notifications"
              />
            </Grid.Col>
          </Grid>

          <PasswordInput
            label="App Password"
            value={emailConfig.password}
            onChange={(e) => handleInputChange('password')(e.target.value)}
            placeholder="Your Gmail App Password"
            leftSection={<IconKey size="1rem" />}
            description="Gmail App Password (not your regular password)"
            required
          />

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Email Folder"
                value={emailConfig.folder}
                onChange={(e) => handleInputChange('folder')(e.target.value)}
                placeholder="INBOX"
                leftSection={<IconMail size="1rem" />}
                description="Folder to monitor for newsletters"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="IMAP Server"
                value={emailConfig.server}
                onChange={(e) => handleInputChange('server')(e.target.value)}
                placeholder="imap.gmail.com"
                leftSection={<IconServer size="1rem" />}
                description="Gmail IMAP server address"
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="SMTP Server"
                value={emailConfig.smtp_server}
                onChange={(e) => handleInputChange('smtp_server')(e.target.value)}
                placeholder="smtp.gmail.com"
                leftSection={<IconServer size="1rem" />}
                description="Gmail SMTP server for sending emails"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="SMTP Port"
                value={emailConfig.smtp_port}
                onChange={(value) => handleInputChange('smtp_port')(value)}
                placeholder="587"
                leftSection={<IconServer size="1rem" />}
                description="Port for SMTP connection (usually 587)"
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end">
            <Button
              leftSection={<IconCheck size="1rem" />}
              onClick={testEmailConfig}
              disabled={isTesting || !emailConfig.username || !emailConfig.password}
              loading={isTesting}
            >
              Test Connection
            </Button>
          </Group>

          {emailTestResult && (
            <Alert
              icon={emailTestResult.success ? <IconCheck size="1rem" /> : <IconX size="1rem" />}
              title={emailTestResult.success ? 'Connection Successful' : 'Connection Failed'}
              color={emailTestResult.success ? 'green' : 'red'}
              variant="light"
            >
              {emailTestResult.success
                ? 'Gmail connection and authentication successful!'
                : emailTestResult.error || 'Failed to connect to Gmail'
              }
            </Alert>
          )}
        </Stack>
      </Card>

      <Text size="xs" c="dimmed" ta="center" mt="md">
        Free to use with your own Gmail account
      </Text>
    </Stack>
  );
};
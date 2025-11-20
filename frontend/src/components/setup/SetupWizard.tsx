// frontend/src/components/setup/SetupWizard.tsx
import React from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stepper,
  Button,
  Group,
  LoadingOverlay,
  Alert,
  Progress,
  Box
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useSetupStore } from '../../hooks/useSetupStore';
import { EmailConfigStep } from './steps/EmailConfigSetup';
import { APIKeysStep } from './steps/APIKeysStep';
import { RSSFeedsStep } from './steps/RSSFeedsStep';
import { ProcessingStep } from './steps/ProcessingStep';
import { ReviewStep } from './steps/ReviewStep';
import { ObsidianStep } from "@/components/setup/steps/ObsidianStep.tsx";

const SetupWizard: React.FC = () => {
  const {
    currentStep,
    isLoading,
    error,
    isConfigured,
    nextStep,
    previousStep,
    setCurrentStep,
    completeSetup,
    validateConfiguration,
    reset
  } = useSetupStore();

  // Setup steps configuration
  const steps = [
    {
      label: 'Email Configuration',
      description: 'Configure your email settings',
      component: <EmailConfigStep />
    },
    {
      label: 'API Keys',
      description: 'Add required API keys',
      component: <APIKeysStep />
    },
    {
      label: 'RSS Feeds',
      description: 'Configure content feeds (optional)',
      component: <RSSFeedsStep />
    },
    {
      label: 'Processing',
      description: 'Set processing preferences',
      component: <ProcessingStep />
    },
    {
      label: 'Obsidian Integration',
      description: 'Configure Obsidian export (optional)',
      component: <ObsidianStep />
    },
    {
      label: 'Review & Complete',
      description: 'Review and save configuration',
      component: <ReviewStep />
    }
  ];

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Final step - validate and complete setup
      try {
        const isValid = await validateConfiguration();
        if (isValid) {
          await completeSetup();
          // Completion will update isConfigured state, triggering redirect in App.tsx
        }
      } catch (error) {
        console.error('Setup completion failed:', error);
        // Error handling is managed by the store
      }
    } else {
      nextStep();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      previousStep();
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep && isLoading) return 'loading';
    return undefined;
  };

  const canProceed = () => {
    // Basic validation - can be enhanced per step
    return !isLoading;
  };

  // If setup is already complete, show completion message
  if (isConfigured) {
    return (
      <Container size="md" py="xl">
        <Paper shadow="md" p="xl" radius="md">
          <Box ta="center">
            <IconCheck size={64} color="green" style={{ marginBottom: 16 }} />
            <Title order={2} mb="md">Setup Complete! 🎉</Title>
            <Text size="lg" c="dimmed" mb="xl">
              Your Research Automation tool is configured and ready to use.
              You'll be redirected to the dashboard automatically.
            </Text>
            <Group justify="center">
              <Button
                variant="light"
                onClick={reset}
                size="lg"
              >
                Reconfigure Settings
              </Button>
              <Button
                size="lg"
                onClick={() => window.location.href = '/dashboard'}
              >
                Go to Dashboard
              </Button>
            </Group>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <LoadingOverlay visible={isLoading} />

      <Paper shadow="md" p="xl" radius="md">
        <Title order={1} mb="xs">Research Automation Setup</Title>
        <Text size="lg" c="dimmed" mb="xl">
          Let's configure your personal research automation tool.
          This will only take a few minutes.
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Configuration Error"
            color="red"
            mb="md"
            variant="light"
          >
            {error}
          </Alert>
        )}

        <Progress
          value={(currentStep + 1) / steps.length * 100}
          mb="xl"
          size="sm"
          radius="xl"
        />

        <Stepper
          active={currentStep}
          onStepClick={setCurrentStep}
          allowNextStepsSelect={false}
          mb="xl"
          size="sm"     // Make steps smaller to prevent overlap
          styles={{
            step: {
              minWidth: '200px',  // Ensure minimum width for each step
            },
            stepLabel: {
              fontSize: '0.875rem',  // Slightly smaller font
            },
            stepDescription: {
              fontSize: '0.75rem',   // Smaller description
            }
          }}
        >
          {steps.map((step, index) => (
            <Stepper.Step
              key={index}
              label={step.label}
              description={step.description}
              loading={getStepStatus(index) === 'loading'}
              completedIcon={<IconCheck size="1rem" />}
            >
              <Box mt="xl">
                {step.component}
              </Box>
            </Stepper.Step>
          ))}
        </Stepper>

        <Group justify="space-between" mt="xl">
          <Button
            variant="light"
            onClick={handleBack}
            disabled={currentStep === 0 || isLoading}
          >
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            loading={isLoading}
          >
            {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next Step'}
          </Button>
        </Group>
      </Paper>
    </Container>
  );
};

export default SetupWizard;
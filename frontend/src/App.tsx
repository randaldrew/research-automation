// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, LoadingOverlay, Container, Button, Alert, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetupStore } from './hooks/useSetupStore';
import { WebSocketProvider } from './components/providers/WebSocketProvider';
import { DashboardLayout } from './components/layout/DashboardLayout';
import SetupWizard from './components/setup/SetupWizard';
import { Dashboard } from './components/pages/Dashboard';
import { Summaries } from './components/pages/Summaries';
import { Links } from './components/pages/Links';
import { Settings } from './components/pages/Settings';
import { Insights } from './components/pages/Insights';
import { IconRefresh } from '@tabler/icons-react';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Mantine theme configuration
const theme = {
  colorScheme: 'light',
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  components: {
    Container: {
      defaultProps: {
        sizes: {
          xs: 540,
          sm: 720,
          md: 960,
          lg: 1140,
          xl: 1320,
        },
      },
    },
  },
};

const App: React.FC = () => {
  const { isLoading, isConfigured, error } = useSetupStore();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize app - check status and load defaults if needed
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Get fresh store references to avoid stale closures
        const store = useSetupStore.getState();

        // Load current configuration status
        await store.loadStatus();

        // If not configured, load default values for the setup wizard
        const updatedState = useSetupStore.getState();
        if (!updatedState.isConfigured) {
          await store.loadDefaults();
        }

        setHasInitialized(true);
      } catch (error: any) {
        console.error('App initialization failed:', error);
        setInitError(error.message || 'Failed to initialize application');
        setHasInitialized(true);
      }
    };

    initializeApp();
  }, []); // Run only once on app mount

  // Manual retry function for error cases
  const handleRetry = async () => {
    setHasInitialized(false);
    setInitError(null);

    try {
      const store = useSetupStore.getState();
      await store.loadStatus();

      const updatedState = useSetupStore.getState();
      if (!updatedState.isConfigured) {
        await store.loadDefaults();
      }

      setHasInitialized(true);
    } catch (error: any) {
      console.error('Retry failed:', error);
      setInitError(error.message || 'Retry failed');
      setHasInitialized(true);
    }
  };

  // Show loading state until initialization completes
  if (!hasInitialized || isLoading) {
    return (
      <MantineProvider theme={theme}>
        <Container size="sm" py="xl" style={{ position: 'relative', height: '100vh' }}>
          <LoadingOverlay visible={true} />
        </Container>
      </MantineProvider>
    );
  }

  // Show error state with retry option
  if (initError || error) {
    return (
      <MantineProvider theme={theme}>
        <Container size="sm" py="xl">
          <Alert color="red" title="Connection Error" mb="md">
            <Text mb="md">{initError || error}</Text>
            <Button
              leftSection={<IconRefresh size="1rem" />}
              onClick={handleRetry}
              variant="light"
            >
              Retry Connection
            </Button>
          </Alert>
        </Container>
      </MantineProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <Router>
            <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
              {!isConfigured ? (
                // Show setup wizard if not configured
                <Routes>
                  <Route path="/setup" element={<SetupWizard />} />
                  <Route path="*" element={<Navigate to="/setup" replace />} />
                </Routes>
              ) : (
                // Show main application if configured
                <WebSocketProvider>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/summaries" element={<Summaries />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/links" element={<Links />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/setup" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </DashboardLayout>
                </WebSocketProvider>
              )}
            </div>
          </Router>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
};

export default App;
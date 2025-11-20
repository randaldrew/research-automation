// frontend/src/components/providers/WebSocketProvider.tsx
import React, { useEffect, useCallback, ReactNode } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useProcessingStore } from '../../hooks/useProcessingStore';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const {
    handleWebSocketMessage,
    setWebSocketConnected,
    processingState
  } = useProcessingStore();

  // Stable callback functions to prevent infinite re-renders
  const handleConnect = useCallback(() => {
    setWebSocketConnected(true);
    console.log('WebSocket connected');
  }, [setWebSocketConnected]);

  const handleDisconnect = useCallback(() => {
    setWebSocketConnected(false);
    console.log('WebSocket disconnected');
  }, [setWebSocketConnected]);

  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
  }, []);

  const {
    isConnected,
    connectionStatus,
    subscribe,
    error: wsError
  } = useWebSocket('/api/v1/ws/processing', {
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError
  });

  // Subscribe to WebSocket messages
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      handleWebSocketMessage(message);

      // Handle special message types for notifications
      if (message.type === 'processing_complete') {
        notifications.show({
          title: 'Processing Complete',
          message: 'Newsletter processing has finished successfully!',
          color: 'green',
          icon: <IconCheck size="1rem" />,
          autoClose: 5000,
        });
      } else if (message.type === 'processing_error') {
        notifications.show({
          title: 'Processing Failed',
          message: message.data?.error || 'An error occurred during processing',
          color: 'red',
          icon: <IconX size="1rem" />,
          autoClose: 10000,
        });
      }
    });

    return unsubscribe;
  }, [subscribe, handleWebSocketMessage]);

  // Show connection status notifications
  useEffect(() => {
    if (connectionStatus === 'error' && wsError) {
      notifications.show({
        id: 'websocket-error',
        title: 'Connection Issue',
        message: 'Real-time updates may not work properly. The app will still function normally.',
        color: 'yellow',
        icon: <IconAlertTriangle size="1rem" />,
        autoClose: 5000,
      });
    } else if (connectionStatus === 'connected') {
      // Clear any existing error notifications
      notifications.hide('websocket-error');
    }
  }, [connectionStatus, wsError]);

  // Request current status when WebSocket connects
  useEffect(() => {
    if (isConnected && processingState.status === 'idle') {
      // Send a status request to get current state
      // The WebSocket will respond with current status
    }
  }, [isConnected, processingState.status]);

  return <>{children}</>;
};
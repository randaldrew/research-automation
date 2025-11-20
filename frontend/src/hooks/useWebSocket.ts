// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: 'status_update' | 'processing_update' | 'processing_complete' | 'processing_error' | 'pong';
  data?: any;
}

export interface WebSocketOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = (url: string, options: WebSocketOptions = {}) => {
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const messageCallbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    cleanup();
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Convert HTTP URL to WebSocket URL
      const wsUrl = url.replace(/^https?:/, window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      const fullUrl = wsUrl.startsWith('ws') ? wsUrl : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsUrl}`;

      websocketRef.current = new WebSocket(fullUrl);

      websocketRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnect?.();

        // Start ping/pong to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send('ping');
          }
        }, 30000); // Ping every 30 seconds
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Notify all subscribers
          messageCallbacksRef.current.forEach(callback => {
            try {
              callback(message);
            } catch (error) {
              console.error('Error in message callback:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocketRef.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      websocketRef.current.onerror = (event) => {
        setConnectionStatus('error');
        setError('WebSocket connection error');
        onError?.(event);
      };

    } catch (error) {
      setConnectionStatus('error');
      setError(`Failed to connect: ${error}`);
      console.error('WebSocket connection error:', error);
    }
  }, [url, reconnectInterval, maxReconnectAttempts, onConnect, onDisconnect, onError, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [cleanup]);

  const send = useCallback((message: string | object) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      websocketRef.current.send(messageStr);
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((callback: (message: WebSocketMessage) => void) => {
    messageCallbacksRef.current.add(callback);

    // Return unsubscribe function
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  // Auto-connect when hook is used
  useEffect(() => {
    connect();

    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    subscribe
  };
};
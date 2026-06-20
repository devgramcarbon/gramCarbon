'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextValue {
  connected: boolean;
  subscribe: (event: string, handler: (data: unknown) => void) => () => void;
  emit: (event: string, data: unknown) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Record<string, Array<(data: unknown) => void>>>({});

  useEffect(() => {
    const socket = io({ path: '/api/socket', reconnectionAttempts: 5, reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const events = ['stock_updated', 'sale_recorded', 'message_sent', 'dashboard_updated', 'notification_created', 'log_created'];
    events.forEach((event) => {
      socket.on(event, (data: unknown) => {
        const handlers = handlersRef.current[event] || [];
        handlers.forEach((fn) => fn(data));
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  const subscribe = useCallback((event: string, handler: (data: unknown) => void) => {
    handlersRef.current[event] = [...(handlersRef.current[event] || []), handler];
    return () => {
      handlersRef.current[event] = (handlersRef.current[event] || []).filter((h) => h !== handler);
    };
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return (
    <SocketContext.Provider value={{ connected, subscribe, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue | null {
  return useContext(SocketContext);
}

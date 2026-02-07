import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStation } from '../contexts/StationContext';

// Use current location in production, localhost in development
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { selectedStation } = useStation();

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      
      // Join station room if station is selected
      if (selectedStation) {
        console.log('Joining station room:', selectedStation.id);
        socket.emit('join-station', {
          stationId: selectedStation.id,
          brigadeId: selectedStation.brigadeId
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('joined-station', (data) => {
      console.log('Successfully joined station room:', data);
    });

    socket.on('join-error', (data) => {
      console.error('Failed to join station room:', data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Re-join when station changes
  useEffect(() => {
    if (socketRef.current && isConnected && selectedStation) {
      console.log('Station changed, joining new room:', selectedStation.id);
      socketRef.current.emit('join-station', {
        stationId: selectedStation.id,
        brigadeId: selectedStation.brigadeId
      });
    }
  }, [selectedStation, isConnected]);

  const emit = (event: string, data: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  const on = <T = unknown>(event: string, callback: (data: T) => void) => {
    if (socketRef.current) {
      // Socket.io expects a more permissive callback signature
      socketRef.current.on(event, callback as (data: unknown) => void);
    }
  };

  const off = <T = unknown>(event: string, callback?: (data: T) => void) => {
    if (socketRef.current) {
      // Socket.io expects a more permissive callback signature
      socketRef.current.off(event, callback as ((data: unknown) => void) | undefined);
    }
  };

  return {
    isConnected,
    emit,
    on,
    off,
  };
}

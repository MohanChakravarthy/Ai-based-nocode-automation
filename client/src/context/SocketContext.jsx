import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [executionProgress, setExecutionProgress] = useState(null);
  const [executionComplete, setExecutionComplete] = useState(null);
  const [screencastFrame, setScreencastFrame] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const socketInstance = io('http://localhost:3001', {
      transports: ['websocket'],
      upgrade: false
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to server');
    });

    socketInstance.on('execution-progress', (data) => {
      console.log('Received progress:', data.currentStep);
      setExecutionProgress(data);
    });

    // Real-time screencast frames
    socketInstance.on('screencast-frame', (data) => {
      // Use ref to avoid re-renders, update state less frequently
      frameRef.current = data.frame;
      setScreencastFrame(data.frame);
    });

    socketInstance.on('execution-complete', (data) => {
      setExecutionComplete(data);
      // Clear screencast and progress after a delay
      setTimeout(() => {
        setExecutionProgress(null);
        setScreencastFrame(null);
      }, 2000);
    });

    socketInstance.on('scheduled-run-started', (data) => {
      console.log('Scheduled run started:', data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const clearExecution = () => {
    setExecutionProgress(null);
    setExecutionComplete(null);
    setScreencastFrame(null);
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      executionProgress, 
      executionComplete,
      screencastFrame,
      clearExecution 
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

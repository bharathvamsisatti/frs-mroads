import React, { createContext, useContext, useEffect, useState } from 'react';

interface WebSocketContextType {
  transactions: any[];
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  transactions: [],
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    // WebSocket support not yet available in backend
    // Using polling/REST API instead for now
    setIsConnected(false);
    // Uncomment below when backend WebSocket support is added
    /*
    const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    const ws = new WebSocket(socketUrl);
    
    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_TRANSACTION' || data.type === 'NEW_ATTENDANCE') {
          setTransactions(prev => [data.payload, ...prev]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      window.setTimeout(() => {
        setSocket(new WebSocket(socketUrl));
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
    */
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_TRANSACTION' || data.type === 'NEW_ATTENDANCE') {
          setTransactions((prev) => [data.payload, ...prev]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
  }, [socket]);

  return (
    <WebSocketContext.Provider value={{ transactions, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

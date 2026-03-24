import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Adjust the PORT to match your backend port (default 3000)
const SOCKET_URL = 'http://localhost:3000';

export function useSocket() {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initialize the socket connection
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        // Event listeners for connection state
        newSocket.on('connect', () => {
            console.log(`[Socket.IO] Connected to ${SOCKET_URL}`);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('[Socket.IO] Disconnected');
            setIsConnected(false);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Helper functions
    const emitEvent = (eventName, data) => {
        if (socket && isConnected) {
            socket.emit(eventName, data);
        }
    };

    return { socket, isConnected, emitEvent };
}

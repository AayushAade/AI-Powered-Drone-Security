import { useEffect, useRef, useCallback } from 'react';

const DEFAULT_IP = '10.10.10.32'; // Laptop's hotspot IP
const WS_URL = `ws://${DEFAULT_IP}:3001`;

export function useWebSocket(onMessage) {
    const ws = useRef(null);
    const onMessageRef = useRef(onMessage);
    const reconnectTimer = useRef(null);

    useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        const socket = new WebSocket(WS_URL);
        ws.current = socket;

        socket.onopen = () => {
            console.log('[WS] Connected');
            socket.send(JSON.stringify({ type: 'REGISTER_DASHBOARD' }));
            onMessageRef.current({ type: 'WS_CONNECTED' });
        };

        socket.onmessage = (e) => {
            try { onMessageRef.current(JSON.parse(e.data)); } catch { }
        };

        socket.onclose = () => {
            console.log('[WS] Disconnected, retrying in 3s...');
            onMessageRef.current({ type: 'WS_DISCONNECTED' });
            reconnectTimer.current = setTimeout(connect, 3000);
        };

        socket.onerror = () => socket.close();
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            ws.current?.close();
        };
    }, [connect]);

    const send = useCallback((data) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data));
        }
    }, []);

    return { send, isConnected: () => ws.current?.readyState === WebSocket.OPEN };
}

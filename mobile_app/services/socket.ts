import { io, Socket } from 'socket.io-client';

// For local testing on a physical device, replace 'localhost' with your computer's IP address
// Examples: '192.168.1.xxx'
const SOCKET_URL = 'http://localhost:3000';

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<Function>> = new Map();

    connect() {
        if (this.socket) return;

        console.log('Connecting to WebSocket server at:', SOCKET_URL);
        this.socket = io(SOCKET_URL, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
            console.log('📱 Connected to Backend Command Center:', this.socket?.id);
            this.notifyListeners('connection_status', true);
        });

        this.socket.on('disconnect', () => {
            console.log('📱 Disconnected from Backend Command Center');
            this.notifyListeners('connection_status', false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.notifyListeners('connection_status', false);
        });

        // Relay specific events to listeners
        this.socket.on('initial_state', (data) => this.notifyListeners('initial_state', data));
        this.socket.on('telemetry_update', (data) => this.notifyListeners('telemetry_update', data));
        this.socket.on('new_alert', (data) => this.notifyListeners('new_alert', data));
        this.socket.on('ai_report', (data) => this.notifyListeners('ai_report', data));
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    emit(event: string, data: any) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn(`Cannot emit '${event}' - Socket not connected`);
        }
    }

    // Pub/Sub pattern for React Components
    subscribe(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Initial state check for connection status
        if (event === 'connection_status' && this.socket) {
            callback(this.socket.connected);
        }

        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event: string, callback: Function) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(callback);
        }
    }

    private notifyListeners(event: string, data: any) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach((callback) => callback(data));
        }
    }
}

export const socketService = new SocketService();

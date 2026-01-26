import { writable } from 'svelte/store';
import { Client, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { Message } from '$lib/types/chat';
import { PUBLIC_CHAT_API_URL } from '$env/static/public';

const WS_BASE_URL = PUBLIC_CHAT_API_URL || 'http://localhost:8080';

interface WebSocketConnection {
    client: Client | null;
    connected: boolean;
    connecting: boolean;
}

export const websocketStore = writable<WebSocketConnection>({
    client: null,
    connected: false,
    connecting: false
});

class WebSocketService {
    private client: Client | null = null;
    private messageHandlers: Map<string, (message: Message) => void> = new Map();
    private activeSubscriptions: Map<string, StompSubscription> = new Map();
    private isConnecting: boolean = false;
    private currentToken: string | null = null;

    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('WebSocket: Attempting to connect...');

            // If already connected with same token, resolve immediately
            if (this.client?.connected && this.currentToken === token) {
                console.log('WebSocket: Already connected');
                resolve();
                return;
            }

            // If currently connecting, wait for it
            if (this.isConnecting) {
                console.log('WebSocket: Connection already in progress');
                resolve();
                return;
            }

            // If connected with different token, disconnect first
            if (this.client?.connected && this.currentToken !== token) {
                console.log('WebSocket: Reconnecting with different token');
                this.client.deactivate();
            }

            this.isConnecting = true;
            this.currentToken = token;
            websocketStore.update(state => ({ ...state, connecting: true }));

            const wsUrl = `${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`;
            console.log('WebSocket: Connecting to', WS_BASE_URL + '/ws');

            this.client = new Client({
                webSocketFactory: () => new SockJS(wsUrl),
                debug: (str) => console.log('STOMP Debug:', str),
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
            });

            this.client.onConnect = () => {
                console.log('WebSocket connected');
                this.isConnecting = false;
                websocketStore.update(state => ({
                    client: this.client,
                    connected: true,
                    connecting: false
                }));

                // Re-subscribe to all previously registered handlers
                this.resubscribeAll();

                resolve();
            };

            this.client.onStompError = (frame) => {
                console.error('STOMP Error:', frame);
                this.isConnecting = false;
                websocketStore.update(state => ({
                    ...state,
                    connected: false,
                    connecting: false
                }));
                reject(new Error(frame.headers['message'] || 'WebSocket connection failed'));
            };

            this.client.onDisconnect = () => {
                console.log('WebSocket disconnected');
                this.isConnecting = false;
                // Clear active subscriptions but keep handlers for reconnect
                this.activeSubscriptions.clear();
                websocketStore.update(state => ({
                    ...state,
                    connected: false,
                    connecting: false
                }));
            };

            this.client.activate();
        });
    }

    private resubscribeAll() {
        if (!this.client?.connected) return;

        console.log('WebSocket: Re-subscribing to', this.messageHandlers.size, 'chat(s)');

        for (const [chatId, handler] of this.messageHandlers) {
            console.log('WebSocket: Re-subscribing to /topic/chat/' + chatId);
            const subscription = this.client.subscribe(`/topic/chat/${chatId}`, (message) => {
                console.log('WebSocket: Received message', message.body);
                try {
                    const parsedMessage: Message = JSON.parse(message.body);
                    handler(parsedMessage);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });
            this.activeSubscriptions.set(chatId, subscription);
        }
    }

    disconnect() {
        // Only disconnect if not currently connecting
        if (this.client && !this.isConnecting) {
            console.log('WebSocket: Disconnecting');
            this.client.deactivate();
            this.client = null;
            this.currentToken = null;
            this.messageHandlers.clear();
            this.activeSubscriptions.clear();
            websocketStore.update(state => ({
                ...state,
                client: null,
                connected: false,
                connecting: false
            }));
        } else if (this.isConnecting) {
            console.log('WebSocket: Skipping disconnect - connection in progress');
        }
    }

    subscribeToChat(chatId: string, onMessage: (message: Message) => void) {
        // Store the handler for reconnection
        this.messageHandlers.set(chatId, onMessage);

        if (!this.client?.connected) {
            console.log('WebSocket: Not connected yet, handler stored for when connection is ready');
            return () => {
                this.messageHandlers.delete(chatId);
                this.activeSubscriptions.get(chatId)?.unsubscribe();
                this.activeSubscriptions.delete(chatId);
            };
        }

        console.log('WebSocket: Subscribing to /topic/chat/' + chatId);

        const subscription = this.client.subscribe(`/topic/chat/${chatId}`, (message) => {
            console.log('WebSocket: Received message', message.body);
            try {
                const parsedMessage: Message = JSON.parse(message.body);
                onMessage(parsedMessage);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        });

        this.activeSubscriptions.set(chatId, subscription);

        return () => {
            subscription.unsubscribe();
            this.messageHandlers.delete(chatId);
            this.activeSubscriptions.delete(chatId);
        };
    }
}

export const webSocketService = new WebSocketService();
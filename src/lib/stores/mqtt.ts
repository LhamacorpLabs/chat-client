import { writable, get } from 'svelte/store';
import mqtt, { type MqttClient } from 'mqtt';
import type { Message } from '$lib/types/chat';
import { PUBLIC_MQTT_BROKER_URL } from '$app/env/public';
import { authStore, getValidToken } from '$lib/stores/auth';
import { logDebugEvent } from '$lib/stores/debugLog';

const MQTT_BROKER_URL = PUBLIC_MQTT_BROKER_URL || 'ws://localhost:9001';

interface MqttConnection {
    connected: boolean;
    connecting: boolean;
}

export const mqttStore = writable<MqttConnection>({
    connected: false,
    connecting: false
});

class MqttService {
    private client: MqttClient | null = null;
    private messageHandlers: Map<string, (message: Message) => void> = new Map();
    private subscribedTopics: Set<string> = new Set();

    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.client?.connected) {
                resolve();
                return;
            }

            mqttStore.update(state => ({ ...state, connecting: true }));
            logDebugEvent('mqtt', 'connect', MQTT_BROKER_URL);

            this.client = mqtt.connect(MQTT_BROKER_URL, {
                reconnectPeriod: 5000,
                connectTimeout: 10000,
                username: token,
                password: token
            });

            this.client.on('connect', () => {
                logDebugEvent('mqtt', 'connected', MQTT_BROKER_URL);
                mqttStore.set({ connected: true, connecting: false });
                this.resubscribeAll();
                resolve();
            });

            this.client.on('error', (err) => {
                console.error('MQTT connection error:', err);
                logDebugEvent('mqtt', 'error', MQTT_BROKER_URL, err.message);
                mqttStore.set({ connected: false, connecting: false });
                reject(err);
            });

            this.client.on('close', () => {
                logDebugEvent('mqtt', 'close', MQTT_BROKER_URL);
                mqttStore.update(state => ({ ...state, connected: false }));
            });

            this.client.on('reconnect', async () => {
                logDebugEvent('mqtt', 'reconnect', MQTT_BROKER_URL);
                mqttStore.update(state => ({ ...state, connecting: true }));

                // mqtt.js can kick off this reconnect attempt's CONNECT
                // packet before the async getValidToken() below resolves,
                // which otherwise means a token rotated right before a
                // disconnect goes out stale on the first retry (only fixed
                // on the *next* automatic reconnect). Apply whatever token
                // we already have synchronously first, so this attempt gets
                // the best available credentials immediately.
                const cachedToken = get(authStore).token;
                if (cachedToken && this.client) {
                    this.client.options.username = cachedToken;
                    this.client.options.password = cachedToken;
                }

                const freshToken = await getValidToken();
                if (freshToken && this.client) {
                    this.client.options.username = freshToken;
                    this.client.options.password = freshToken;
                } else if (!freshToken) {
                    this.disconnect();
                }
            });

            this.client.on('message', (topic, payload) => {
                try {
                    const message: Message = JSON.parse(payload.toString());
                    const chatId = this.extractChatIdFromTopic(topic);
                    if (chatId) {
                        const handler = this.messageHandlers.get(chatId);
                        handler?.(message);
                    }
                } catch (error) {
                    console.error('Failed to parse MQTT message:', error);
                }
            });
        });
    }

    disconnect() {
        if (this.client) {
            logDebugEvent('mqtt', 'disconnect', MQTT_BROKER_URL);
            this.client.end();
            this.client = null;
            this.messageHandlers.clear();
            this.subscribedTopics.clear();
            mqttStore.set({ connected: false, connecting: false });
        }
    }

    subscribeToChat(chatId: string, onMessage: (message: Message) => void): () => void {
        const topic = `chat/${chatId}/messages`;
        this.messageHandlers.set(chatId, onMessage);

        if (this.client?.connected) {
            this.client.subscribe(topic);
            this.subscribedTopics.add(topic);
        }

        return () => {
            this.messageHandlers.delete(chatId);
            if (this.client?.connected) {
                this.client.unsubscribe(topic);
            }
            this.subscribedTopics.delete(topic);
        };
    }

    private resubscribeAll() {
        if (!this.client?.connected) return;

        for (const [chatId] of this.messageHandlers) {
            const topic = `chat/${chatId}/messages`;
            this.client.subscribe(topic);
            this.subscribedTopics.add(topic);
        }
    }

    ensureConnected(): boolean {
        if (this.client?.connected) return true;

        if (this.client) {
            this.client.reconnect();
        }
        return false;
    }

    isConnected(): boolean {
        return this.client?.connected ?? false;
    }

    private extractChatIdFromTopic(topic: string): string | null {
        const match = topic.match(/^chat\/(.+)\/messages$/);
        return match?.[1] ?? null;
    }
}

export const mqttService = new MqttService();

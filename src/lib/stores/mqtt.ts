import { writable } from 'svelte/store';
import mqtt, { type MqttClient } from 'mqtt';
import type { Message } from '$lib/types/chat';
import { PUBLIC_MQTT_BROKER_URL } from '$env/static/public';

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

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.client?.connected) {
                resolve();
                return;
            }

            mqttStore.update(state => ({ ...state, connecting: true }));

            this.client = mqtt.connect(MQTT_BROKER_URL, {
                reconnectPeriod: 5000,
                connectTimeout: 10000
            });

            this.client.on('connect', () => {
                mqttStore.set({ connected: true, connecting: false });
                this.resubscribeAll();
                resolve();
            });

            this.client.on('error', (err) => {
                console.error('MQTT connection error:', err);
                mqttStore.set({ connected: false, connecting: false });
                reject(err);
            });

            this.client.on('close', () => {
                mqttStore.update(state => ({ ...state, connected: false }));
            });

            this.client.on('reconnect', () => {
                mqttStore.update(state => ({ ...state, connecting: true }));
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

    private extractChatIdFromTopic(topic: string): string | null {
        const match = topic.match(/^chat\/(.+)\/messages$/);
        return match?.[1] ?? null;
    }
}

export const mqttService = new MqttService();

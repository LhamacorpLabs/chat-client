import { get } from 'svelte/store';
import { fetchChatMetadata } from '../api/chat.js';
import { chatNotifications } from '../stores/chatNotifications.js';
import { authStore } from '../stores/auth.js';
import type { ChatMetadata } from '../types/chat.js';

interface MetadataPollingService {
	start: (chatIds: string[]) => void;
	stop: () => void;
	updateChatIds: (chatIds: string[]) => void;
	isRunning: () => boolean;
}

function createMetadataPollingService(): MetadataPollingService {
	let intervalId: number | null = null;
	let isPolling = false;
	let currentChatIds: string[] = [];

	const POLL_INTERVAL = 10000; // 10 seconds
	const STAGGER_DELAY = 100; // 100ms between requests

	async function pollChatMetadata(chatId: string): Promise<ChatMetadata | null> {
		try {
			const authState = get(authStore);
			if (!authState.token) {
				return null;
			}

			return await fetchChatMetadata(authState.token, chatId);
		} catch (error) {
			console.warn(`Failed to fetch metadata for chat ${chatId}:`, error);
			return null;
		}
	}

	async function pollAllChatsMetadata() {
		if (!isPolling || currentChatIds.length === 0) {
			return;
		}

		const metadataResponses: ChatMetadata[] = [];
		for (let i = 0; i < currentChatIds.length; i++) {
			const chatId = currentChatIds[i];

			// Add stagger delay (except for first request)
			if (i > 0) {
				await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
			}

			const metadata = await pollChatMetadata(chatId);
			if (metadata) {
				metadataResponses.push(metadata);
			}
		}

		const chatLikeObjects = metadataResponses.map(metadata => ({
			id: metadata.id,
			lastMessageAt: metadata.lastMessageAt,
			name: '',
			members: [],
			createdBy: '',
			createdAt: '',
			updatedAt: ''
		}));
		if (chatLikeObjects.length > 0) {
			chatNotifications.checkForUpdates(chatLikeObjects);
		}
	}

	return {
		start: (chatIds: string[]) => {
			if (isPolling) {
				currentChatIds = [...chatIds];
				return;
			}

			currentChatIds = [...chatIds];
			isPolling = true;

			pollAllChatsMetadata();
			intervalId = window.setInterval(pollAllChatsMetadata, POLL_INTERVAL);

			console.log(`Metadata polling started for ${chatIds.length} chats`);
		},

		stop: () => {
			if (!isPolling) {
				return;
			}

			isPolling = false;
			currentChatIds = [];

			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}

			console.log('Metadata polling stopped');
		},

		updateChatIds: (chatIds: string[]) => {
			currentChatIds = [...chatIds];
			console.log(`Updated metadata polling for ${chatIds.length} chats`);
		},

		isRunning: () => isPolling
	};
}

export const metadataPollingService = createMetadataPollingService();
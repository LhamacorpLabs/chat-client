import { writable, get } from 'svelte/store';
import { loadPersisted, savePersisted } from '../utils/localJsonStore.js';

interface ChatMuteState {
	// Map of chatId -> boolean (true = muted)
	mutedChats: Record<string, boolean>;
}

const STORAGE_KEY = 'chat-mute-settings';

// Load initial state from localStorage
function loadFromStorage(): ChatMuteState {
	const stored = loadPersisted<Partial<ChatMuteState>>(STORAGE_KEY, {});
	return { mutedChats: stored.mutedChats || {} };
}

// Save state to localStorage
function saveToStorage(state: ChatMuteState): void {
	savePersisted(STORAGE_KEY, state);
}

// Create the store
const store = writable<ChatMuteState>(loadFromStorage());
const { subscribe, update } = store;

export const chatMuteStore = {
	subscribe,

	/**
	 * Toggle mute status for a chat
	 */
	toggleMute: (chatId: string) => {
		update(state => {
			const newState = {
				...state,
				mutedChats: {
					...state.mutedChats,
					[chatId]: !state.mutedChats[chatId]
				}
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Mute a specific chat
	 */
	muteChat: (chatId: string) => {
		update(state => {
			const newState = {
				...state,
				mutedChats: {
					...state.mutedChats,
					[chatId]: true
				}
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Unmute a specific chat
	 */
	unmuteChat: (chatId: string) => {
		update(state => {
			const newState = {
				...state,
				mutedChats: {
					...state.mutedChats,
					[chatId]: false
				}
			};
			saveToStorage(newState);
			return newState;
		});
	},

	/**
	 * Check if a chat is muted
	 */
	isMuted: (chatId: string): boolean => {
		const state = get(store);
		return state.mutedChats[chatId] || false;
	},

	/**
	 * Get all muted chat IDs
	 */
	getMutedChats: (): string[] => {
		const state = get(store);
		return Object.entries(state.mutedChats)
			.filter(([_, isMuted]) => isMuted)
			.map(([chatId, _]) => chatId);
	},

	/**
	 * Clear all mute settings
	 */
	clear: () => {
		update(() => {
			const newState = { mutedChats: {} };
			saveToStorage(newState);
			return newState;
		});
	}
};
import { writable } from 'svelte/store';

interface ChatMuteState {
	// Map of chatId -> boolean (true = muted)
	mutedChats: Record<string, boolean>;
}

const STORAGE_KEY = 'chat-mute-settings';

// Load initial state from localStorage
function loadFromStorage(): ChatMuteState {
	if (typeof window === 'undefined') return { mutedChats: {} };

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				mutedChats: parsed.mutedChats || {}
			};
		}
	} catch (error) {
		console.warn('Failed to load chat mute settings from localStorage:', error);
	}

	return { mutedChats: {} };
}

// Save state to localStorage
function saveToStorage(state: ChatMuteState): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.warn('Failed to save chat mute settings to localStorage:', error);
	}
}

// Create the store
const { subscribe, update } = writable<ChatMuteState>(loadFromStorage());

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
		let isMuted = false;
		const unsubscribe = subscribe(state => {
			isMuted = state.mutedChats[chatId] || false;
		});
		unsubscribe();
		return isMuted;
	},

	/**
	 * Get all muted chat IDs
	 */
	getMutedChats: (): string[] => {
		let mutedChats: string[] = [];
		const unsubscribe = subscribe(state => {
			mutedChats = Object.entries(state.mutedChats)
				.filter(([_, isMuted]) => isMuted)
				.map(([chatId, _]) => chatId);
		});
		unsubscribe();
		return mutedChats;
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
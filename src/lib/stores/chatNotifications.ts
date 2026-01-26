import { writable, get } from 'svelte/store';
import type { Chat } from '../types/chat.js';
import { playNotificationSound, isWindowFocused } from '../utils/notificationSound.js';
import { showMessageNotification } from '../utils/osNotification.js';
import { chatMuteStore } from './chatMute.js';

interface ChatNotificationState {
	// Map of chatId -> last known lastMessageAt timestamp
	lastKnownTimestamps: Record<string, string | null>;
	// Map of chatId -> boolean indicating if there are unread messages
	hasUnreadMessages: Record<string, boolean>;
}

interface ChatNotificationStore {
	subscribe: typeof subscribe;
	// Update the last known timestamp for a chat (call this when user views chat)
	markChatAsRead: (chatId: string, timestamp: string | null) => void;
	// Check for new messages across all chats and update unread status
	checkForUpdates: (chats: Chat[]) => void;
	// Get unread status for a specific chat
	isUnread: (chatId: string) => boolean;
	// Get the last known timestamp for a chat
	getLastKnownTimestamp: (chatId: string) => string | null;
	// Clear all notifications (e.g., on logout)
	clear: () => void;
	// Initialize from localStorage
	initialize: () => void;
}

function createChatNotificationStore(): ChatNotificationStore {
	const initialState: ChatNotificationState = {
		lastKnownTimestamps: {},
		hasUnreadMessages: {}
	};

	const store = writable(initialState);
	const { subscribe, update } = store;

	// Helper to save state to localStorage
	function saveToStorage(state: ChatNotificationState) {
		try {
			localStorage.setItem('chat-notifications', JSON.stringify(state));
		} catch (error) {
			console.warn('Failed to save chat notifications to localStorage:', error);
		}
	}

	// Helper to load state from localStorage
	function loadFromStorage(): ChatNotificationState {
		try {
			const stored = localStorage.getItem('chat-notifications');
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.warn('Failed to load chat notifications from localStorage:', error);
		}
		return initialState;
	}

	return {
		subscribe,

		markChatAsRead: (chatId: string, timestamp: string | null) => {
			update(state => {
				const newState = {
					...state,
					lastKnownTimestamps: {
						...state.lastKnownTimestamps,
						[chatId]: timestamp
					},
					hasUnreadMessages: {
						...state.hasUnreadMessages,
						[chatId]: false
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		checkForUpdates: (chats: Chat[]) => {
			update(state => {
				let hasChanges = false;
				let shouldPlaySound = false;
				let notificationChat: Chat | null = null;
				const newUnreadMessages = { ...state.hasUnreadMessages };

				for (const chat of chats) {
					const lastKnown = state.lastKnownTimestamps[chat.id];
					const current = chat.lastMessageAt;
					const wasUnread = state.hasUnreadMessages[chat.id] || false;

					// Check if there's a new message using timestamp comparison
					if (current !== null && (lastKnown === undefined || new Date(current) > new Date(lastKnown || 0))) {
						// Only mark as unread if we had a previous timestamp (not first time seeing this chat)
						if (lastKnown !== undefined) {
							newUnreadMessages[chat.id] = true;
							hasChanges = true;

							// Only play sound if this chat was NOT already unread (status changed from read to unread)
							if (!wasUnread) {
								shouldPlaySound = true;
								notificationChat = chat;
							}
						}
					}
				}

				// Play notification sound only if status changed from read to unread and window is not focused
				if (shouldPlaySound && !isWindowFocused()) {
					// Check if the chat is muted before playing notifications
					const isChatMuted = notificationChat ? chatMuteStore.isMuted(notificationChat.id) : false;

					if (!isChatMuted) {
						playNotificationSound();

						// Show OS notification for the chat with new messages
						if (notificationChat) {
							showMessageNotification({
								title: `New message in ${notificationChat.name}`,
								body: `You have a new message`,
								chatId: notificationChat.id,
								tag: `chat-${notificationChat.id}`
							});
						}
					}
				}

				if (hasChanges) {
					const newState = {
						...state,
						hasUnreadMessages: newUnreadMessages
					};
					saveToStorage(newState);
					return newState;
				}

				return state;
			});
		},

		isUnread: (chatId: string) => {
			const state = get(store);
			return state.hasUnreadMessages[chatId] || false;
		},

		getLastKnownTimestamp: (chatId: string) => {
			const state = get(store);
			return state.lastKnownTimestamps[chatId] || null;
		},

		clear: () => {
			update(() => {
				const clearedState = {
					lastKnownTimestamps: {},
					hasUnreadMessages: {}
				};
				saveToStorage(clearedState);
				return clearedState;
			});
		},

		initialize: () => {
			const loadedState = loadFromStorage();
			update(() => loadedState);
		}
	};
}

export const chatNotifications = createChatNotificationStore();
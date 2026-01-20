import { writable } from 'svelte/store';
import type { Chat, CreateChatRequest } from '../types/chat';
import { fetchChats as apiFetchChats, createChat as apiCreateChat, deleteChat as apiDeleteChat } from '../api/chat';
import { chatNotifications } from './chatNotifications';

interface ChatState {
	chats: Chat[];
	isLoading: boolean;
	isCreating: boolean;
	isDeleting: boolean;
	error: string | null;
}

const initialState: ChatState = {
	chats: [],
	isLoading: false,
	isCreating: false,
	isDeleting: false,
	error: null
};

// Main chat store
export const chatStore = writable<ChatState>(initialState);

// Fetch chats from API
export async function fetchChats(token: string, silent: boolean = false) {
	// Only show loading state if not silent
	if (!silent) {
		chatStore.update(state => ({ ...state, isLoading: true, error: null }));
	}

	try {
		const chats = await apiFetchChats(token);
		chatStore.update(state => ({
			...state,
			chats,
			isLoading: false,
			error: silent ? state.error : null // Don't clear errors in silent mode
		}));

		// Check for new messages and update notification status
		chatNotifications.checkForUpdates(chats);

		return true;
	} catch (error) {
		// In silent mode, don't update error state to avoid showing error messages
		if (!silent) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to fetch chats';
			chatStore.update(state => ({
				...state,
				isLoading: false,
				error: errorMessage
			}));
		}
		return false;
	}
}

// Create a new chat
export async function createChat(token: string, chatData: CreateChatRequest) {
	chatStore.update(state => ({ ...state, isCreating: true, error: null }));

	try {
		const newChat = await apiCreateChat(token, chatData);
		chatStore.update(state => ({
			...state,
			chats: [...state.chats, newChat],
			isCreating: false,
			error: null
		}));
		return newChat;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to create chat';
		chatStore.update(state => ({
			...state,
			isCreating: false,
			error: errorMessage
		}));
		return null;
	}
}

// Delete a chat
export async function deleteChat(token: string, chatId: string) {
	chatStore.update(state => ({ ...state, isDeleting: true, error: null }));

	try {
		await apiDeleteChat(token, chatId);
		chatStore.update(state => ({
			...state,
			chats: state.chats.filter(chat => chat.id !== chatId),
			isDeleting: false,
			error: null
		}));
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete chat';
		chatStore.update(state => ({
			...state,
			isDeleting: false,
			error: errorMessage
		}));
		return false;
	}
}

// Clear chat store
export function clearChats() {
	chatStore.set(initialState);
}
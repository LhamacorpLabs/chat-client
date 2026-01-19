import { writable } from 'svelte/store';
import type { Chat, CreateChatRequest } from '../types/chat';
import { fetchChats as apiFetchChats, createChat as apiCreateChat } from '../api/chat';

interface ChatState {
	chats: Chat[];
	isLoading: boolean;
	isCreating: boolean;
	error: string | null;
}

const initialState: ChatState = {
	chats: [],
	isLoading: false,
	isCreating: false,
	error: null
};

// Main chat store
export const chatStore = writable<ChatState>(initialState);

// Fetch chats from API
export async function fetchChats(token: string) {
	chatStore.update(state => ({ ...state, isLoading: true, error: null }));

	try {
		const chats = await apiFetchChats(token);
		chatStore.update(state => ({
			...state,
			chats,
			isLoading: false,
			error: null
		}));
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to fetch chats';
		chatStore.update(state => ({
			...state,
			isLoading: false,
			error: errorMessage
		}));
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

// Clear chat store
export function clearChats() {
	chatStore.set(initialState);
}
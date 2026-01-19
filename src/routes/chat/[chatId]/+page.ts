import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth';
import { chatStore } from '$lib/stores/chat';
import { fetchChats } from '$lib/api/chat';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { chatId } = params;

	// Check auth from localStorage directly (since store may not be loaded yet)
	let auth = get(authStore);
	console.log('Initial auth from store:', auth.token ? 'has token' : 'no token');

	if (!auth.token && typeof localStorage !== 'undefined') {
		console.log('Checking localStorage for auth data');
		const saved = localStorage.getItem('auth_data');
		if (saved) {
			try {
				const authData = JSON.parse(saved);
				console.log('Found auth data in localStorage for user:', authData.username);
				auth = {
					user: {
						id: authData.id,
						username: authData.username,
						email: authData.email,
						roles: authData.roles
					},
					token: authData.token,
					isLoading: false,
					error: null
				};
				// Update the store
				authStore.set(auth);
			} catch (e) {
				console.log('Failed to parse auth data from localStorage:', e);
				localStorage.removeItem('auth_data');
			}
		} else {
			console.log('No auth data found in localStorage');
		}
	}

	// Redirect to login if not authenticated
	if (!auth.token) {
		console.log('No auth token, redirecting to login');
		throw redirect(302, '/login');
	}

	console.log('Auth check passed for user:', auth.user?.username);

	// Get current chats from store
	let chats = get(chatStore).chats;

	// If no chats in store, fetch them from API
	if (chats.length === 0) {
		try {
			console.log('Fetching chats for chatId:', chatId);
			const chatsResponse = await fetchChats(auth.token);
			chats = chatsResponse; // chatsResponse is directly an array of chats
			console.log('Fetched chats:', chats.length, 'chats');

			// Update the store with fetched chats
			chatStore.update(state => ({
				...state,
				chats: chats,
				isLoading: false,
				error: null
			}));
		} catch (error) {
			console.error('Failed to fetch chats:', error);
			// If fetch fails, redirect to main page
			throw redirect(302, '/');
		}
	}

	// Validate that the chat exists and user has access
	const chat = chats.find(c => c.id === chatId);
	console.log('Looking for chatId:', chatId, 'in', chats.map(c => c.id));
	if (!chat) {
		console.log('Chat not found, redirecting to main page');
		// Chat not found, redirect to main page
		throw redirect(302, '/');
	}

	console.log('Found chat:', chat.name, 'proceeding to load page');

	// Return the chat data
	return {
		chatId,
		chat,
		isOwner: chat.createdBy === auth.user?.id
	};
};
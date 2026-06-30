import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore, authLoaded, loadAuth, checkAndRefreshToken } from '$lib/stores/auth';
import { chatStore } from '$lib/stores/chat';
import { fetchChats } from '$lib/api/chat';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { chatId } = params;

	if (!get(authLoaded)) {
		await loadAuth();
	}

	const auth = get(authStore);

	if (!auth.token) {
		throw redirect(302, '/login');
	}

	const tokenValid = await checkAndRefreshToken();
	if (!tokenValid) {
		throw redirect(302, '/login');
	}

	let chats = get(chatStore).chats;

	if (chats.length === 0) {
		try {
			const chatsResponse = await fetchChats(auth.token!);
			chats = chatsResponse;

			chatStore.update(state => ({
				...state,
				chats: chats,
				isLoading: false,
				error: null
			}));
		} catch (error) {
			throw redirect(302, '/');
		}
	}

	const chat = chats.find(c => c.id === chatId);
	if (!chat) {
		throw redirect(302, '/');
	}

	return {
		chatId,
		chat,
		isOwner: chat.createdBy === auth.user?.id
	};
};

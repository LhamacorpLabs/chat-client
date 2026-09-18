import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore, checkAndRefreshToken } from '$lib/stores/auth';
import { chatStore } from '$lib/stores/chat';
import { fetchChats } from '$lib/api/chat';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { chatId } = params;

	let auth = get(authStore);

	if (!auth.token && typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('auth_data');
		if (saved) {
			try {
				const authData = JSON.parse(saved);
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
				authStore.set(auth);
			} catch {
				localStorage.removeItem('auth_data');
			}
		}
	}

	if (!auth.token) {
		throw redirect(302, '/login');
	}

	const tokenValid = await checkAndRefreshToken();
	if (!tokenValid) {
		throw redirect(302, '/login');
	}
	auth = get(authStore);

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
		} catch {
			throw redirect(302, '/');
		}
	}

	const chat = chats.find(c => c.id === chatId);
	if (!chat) {
		throw redirect(302, '/');
	}

	// createdBy is a userId, and backend ids aren't guaranteed stable across
	// environments/resets - resolve it to the creator's username (via the
	// member list, which already doubles as the id->username map elsewhere
	// in this app) and compare that, falling back to the raw id check only
	// if the creator isn't in the current member list.
	const creator = chat.members.find(member => member.id === chat.createdBy);
	const isOwner = creator
		? creator.name === auth.user?.username
		: chat.createdBy === auth.user?.id;

	return {
		chatId,
		chat,
		isOwner
	};
};
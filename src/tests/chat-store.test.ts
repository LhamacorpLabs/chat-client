import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$env/static/public', () => ({
	PUBLIC_CHAT_API_URL: 'http://localhost:8080'
}));

const mockFetchChats = vi.fn();
const mockCreateChat = vi.fn();
const mockDeleteChat = vi.fn();

vi.mock('$lib/api/chat', () => ({
	fetchChats: (...args: any[]) => mockFetchChats(...args),
	createChat: (...args: any[]) => mockCreateChat(...args),
	deleteChat: (...args: any[]) => mockDeleteChat(...args)
}));

import { chatStore, fetchChats, createChat, deleteChat, clearChats } from '$lib/stores/chat';

beforeEach(() => {
	clearChats();
	vi.clearAllMocks();
});

describe('Chat Store - Create Chat', () => {
	it('sets isCreating while creating', async () => {
		mockCreateChat.mockImplementation(() => new Promise(() => {}));

		const promise = createChat('token', { name: 'Test Chat' });

		expect(get(chatStore).isCreating).toBe(true);
		expect(get(chatStore).error).toBeNull();
	});

	it('adds new chat to store on success', async () => {
		const newChat = {
			id: 'chat-1',
			name: 'Test Chat',
			members: [{ id: 'user-1', name: 'User' }],
			createdBy: 'user-1',
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
			lastMessageAt: null
		};
		mockCreateChat.mockResolvedValue(newChat);

		const result = await createChat('token', { name: 'Test Chat' });

		expect(result).toEqual(newChat);
		expect(get(chatStore).chats).toHaveLength(1);
		expect(get(chatStore).chats[0]).toEqual(newChat);
		expect(get(chatStore).isCreating).toBe(false);
		expect(get(chatStore).error).toBeNull();
	});

	it('sets error on failure', async () => {
		mockCreateChat.mockRejectedValue(new Error('Network error'));

		const result = await createChat('token', { name: 'Test Chat' });

		expect(result).toBeNull();
		expect(get(chatStore).chats).toHaveLength(0);
		expect(get(chatStore).isCreating).toBe(false);
		expect(get(chatStore).error).toBe('Network error');
	});

	it('passes token and chat data to API', async () => {
		mockCreateChat.mockResolvedValue({ id: '1', name: 'My Chat' });

		await createChat('my-token', { name: 'My Chat' });

		expect(mockCreateChat).toHaveBeenCalledWith('my-token', { name: 'My Chat' });
	});

	it('appends to existing chats', async () => {
		const existingChat = {
			id: 'chat-0',
			name: 'Existing',
			members: [],
			createdBy: 'user-1',
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
			lastMessageAt: null
		};
		mockFetchChats.mockResolvedValue([existingChat]);
		await fetchChats('token');

		const newChat = { ...existingChat, id: 'chat-1', name: 'New Chat' };
		mockCreateChat.mockResolvedValue(newChat);
		await createChat('token', { name: 'New Chat' });

		expect(get(chatStore).chats).toHaveLength(2);
		expect(get(chatStore).chats[1].name).toBe('New Chat');
	});
});

describe('Chat Store - Fetch Chats', () => {
	it('sets isLoading while fetching', async () => {
		mockFetchChats.mockImplementation(() => new Promise(() => {}));

		fetchChats('token');

		expect(get(chatStore).isLoading).toBe(true);
	});

	it('populates chats on success', async () => {
		const chats = [
			{ id: '1', name: 'Chat 1', members: [], createdBy: 'u1', createdAt: '', updatedAt: '', lastMessageAt: null },
			{ id: '2', name: 'Chat 2', members: [], createdBy: 'u1', createdAt: '', updatedAt: '', lastMessageAt: null }
		];
		mockFetchChats.mockResolvedValue(chats);

		await fetchChats('token');

		expect(get(chatStore).chats).toHaveLength(2);
		expect(get(chatStore).isLoading).toBe(false);
	});

	it('sets error on failure', async () => {
		mockFetchChats.mockRejectedValue(new Error('Unauthorized'));

		await fetchChats('token');

		expect(get(chatStore).error).toBe('Unauthorized');
		expect(get(chatStore).isLoading).toBe(false);
	});

	it('silent mode does not show loading or errors', async () => {
		mockFetchChats.mockRejectedValue(new Error('Fail'));

		await fetchChats('token', true);

		expect(get(chatStore).isLoading).toBe(false);
		expect(get(chatStore).error).toBeNull();
	});
});

describe('Chat Store - Delete Chat', () => {
	it('removes chat from store on success', async () => {
		mockFetchChats.mockResolvedValue([
			{ id: '1', name: 'Chat 1', members: [], createdBy: 'u1', createdAt: '', updatedAt: '', lastMessageAt: null },
			{ id: '2', name: 'Chat 2', members: [], createdBy: 'u1', createdAt: '', updatedAt: '', lastMessageAt: null }
		]);
		await fetchChats('token');
		mockDeleteChat.mockResolvedValue(undefined);

		const result = await deleteChat('token', '1');

		expect(result).toBe(true);
		expect(get(chatStore).chats).toHaveLength(1);
		expect(get(chatStore).chats[0].id).toBe('2');
	});

	it('sets error on failure', async () => {
		mockDeleteChat.mockRejectedValue(new Error('Forbidden'));

		const result = await deleteChat('token', '1');

		expect(result).toBe(false);
		expect(get(chatStore).error).toBe('Forbidden');
	});
});

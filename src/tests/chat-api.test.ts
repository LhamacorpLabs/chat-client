import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CHAT_API_URL: 'http://localhost:8080',
	PUBLIC_AUTH_API_URL: 'http://localhost:8081',
	PUBLIC_AUTH_UI_URL: 'http://localhost:3000'
}));

import { createChat, sendMessage, fetchMessagesPaginated } from '$lib/api/chat';

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('Chat API - Create Chat', () => {
	it('sends POST with correct headers and body', async () => {
		const mockChat = { id: 'chat-1', name: 'New Chat' };
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockChat)
		} as Response);

		const result = await createChat('my-token', { name: 'New Chat' });

		expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/chats', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer my-token'
			},
			body: JSON.stringify({ name: 'New Chat' })
		});
		expect(result).toEqual(mockChat);
	});

	it('throws on non-ok response', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: false,
			status: 403
		} as Response);

		await expect(createChat('token', { name: 'Chat' }))
			.rejects.toThrow('Failed to create chat: 403');
	});

	it('throws on network error', async () => {
		vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

		await expect(createChat('token', { name: 'Chat' }))
			.rejects.toThrow('Network error');
	});
});

describe('Chat API - Send Message', () => {
	it('sends POST with message body', async () => {
		const mockMessage = {
			id: 'msg-1',
			chatId: 'chat-1',
			userId: 'user-1',
			username: 'TestUser',
			message: 'Hello!',
			createdAt: '2024-01-01T00:00:00Z'
		};
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockMessage)
		} as Response);

		const result = await sendMessage('my-token', 'chat-1', { message: 'Hello!' });

		expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/chats/chat-1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer my-token'
			},
			body: JSON.stringify({ message: 'Hello!' })
		});
		expect(result).toEqual(mockMessage);
	});

	it('throws on non-ok response', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: false,
			status: 401
		} as Response);

		await expect(sendMessage('token', 'chat-1', { message: 'Hi' }))
			.rejects.toThrow('Failed to send message: 401');
	});

	it('sends message with image references', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ id: 'msg-2' })
		} as Response);

		await sendMessage('token', 'chat-1', { message: 'Check this\nimage:img-123' });

		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/chats/chat-1/messages',
			expect.objectContaining({
				body: JSON.stringify({ message: 'Check this\nimage:img-123' })
			})
		);
	});
});

describe('Chat API - Fetch Messages Paginated', () => {
	it('fetches with default limit', async () => {
		const mockResponse = {
			messages: [],
			nextCursor: null,
			prevCursor: null,
			hasMore: false
		};
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		} as Response);

		await fetchMessagesPaginated('token', 'chat-1');

		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/chats/chat-1/messages?limit=50',
			expect.objectContaining({
				method: 'GET',
				headers: { 'Authorization': 'Bearer token' }
			})
		);
	});

	it('includes before cursor param', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ messages: [], nextCursor: null, prevCursor: null, hasMore: false })
		} as Response);

		await fetchMessagesPaginated('token', 'chat-1', 20, 'cursor-abc');

		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/chats/chat-1/messages?limit=20&before=cursor-abc',
			expect.anything()
		);
	});

	it('includes after cursor param', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ messages: [], nextCursor: null, prevCursor: null, hasMore: false })
		} as Response);

		await fetchMessagesPaginated('token', 'chat-1', 50, undefined, 'cursor-xyz');

		expect(fetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/chats/chat-1/messages?limit=50&after=cursor-xyz',
			expect.anything()
		);
	});

	it('throws on non-ok response', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: false,
			status: 404
		} as Response);

		await expect(fetchMessagesPaginated('token', 'chat-1'))
			.rejects.toThrow('Failed to fetch paginated messages: 404');
	});
});

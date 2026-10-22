import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$app/env/public', () => ({
	PUBLIC_CHAT_API_URL: 'http://localhost:8080',
	PUBLIC_AUTH_API_URL: 'http://localhost:8081',
	PUBLIC_AUTH_UI_URL: 'http://localhost:3000'
}));

import { createChat, sendMessage, fetchMessagesPaginated, fetchMultipleMessageReactions } from '$lib/api/chat';

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
			body: JSON.stringify({ name: 'New Chat' }),
			signal: expect.any(AbortSignal)
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
			body: JSON.stringify({ message: 'Hello!' }),
			signal: expect.any(AbortSignal)
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

describe('Chat API - Reactions', () => {
	const reaction = (messageId: string, userId: string) => ({ chatId: 'c1', messageId, userId, type: 'LIKE', createdAt: '' });

	it('fetches reactions for all messages in one request from the oldest id', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([reaction('01B', 'u1'), reaction('01B', 'u2'), reaction('01D', 'u1')])
		} as Response);

		const result = await fetchMultipleMessageReactions('token', 'c1', ['01B', '01A', '01C']);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://localhost:8080/api/chats/c1/messages/reacts?from=01A');
		expect(result['01A']).toEqual([]);
		expect(result['01B']).toHaveLength(2);
		expect(result['01C']).toEqual([]);
		// Reactions on messages that aren't loaded are ignored.
		expect(result['01D']).toBeUndefined();
	});

	it('makes no request without messages', async () => {
		vi.spyOn(global, 'fetch');

		expect(await fetchMultipleMessageReactions('token', 'c1', [])).toEqual({});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('falls back to one request per message when the server has no bulk endpoint', async () => {
		vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes('/messages/reacts?')) return { ok: false, status: 404 } as Response;
			return { ok: true, json: () => Promise.resolve(url.includes('/01A/') ? [reaction('01A', 'u1')] : []) } as Response;
		});

		const result = await fetchMultipleMessageReactions('token', 'c1', ['01A', '01B']);

		expect(fetch).toHaveBeenCalledTimes(3);
		expect(result['01A']).toHaveLength(1);
		expect(result['01B']).toEqual([]);
	});

	it('returns no reactions instead of failing when the request fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);

		expect(await fetchMultipleMessageReactions('token', 'c1', ['01A'])).toEqual({ '01A': [] });
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

import type { Chat, CreateChatRequest, ChatsResponse, MessagesResponse, PagedMessageResponse, Message, SendMessageRequest, Invitation, RedeemInvitationRequest } from '../types/chat';
import { PUBLIC_CHAT_API_URL } from '$env/static/public';

const CHAT_API_URL = `${PUBLIC_CHAT_API_URL || 'http://localhost:8080'}/api/chats`;

export async function fetchChats(token: string): Promise<ChatsResponse> {
	const response = await fetch(CHAT_API_URL, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch chats: ${response.status}`);
	}

	return response.json();
}

export async function createChat(token: string, chatData: CreateChatRequest): Promise<Chat> {
	const response = await fetch(CHAT_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(chatData)
	});

	if (!response.ok) {
		throw new Error(`Failed to create chat: ${response.status}`);
	}

	return response.json();
}

export async function fetchMessages(token: string, chatId: string): Promise<MessagesResponse> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages/legacy`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch messages: ${response.status}`);
	}

	return response.json();
}

/**
 * Fetch paginated messages with cursor-based pagination
 * @param token Bearer token for authentication
 * @param chatId Chat ID to fetch messages for
 * @param limit Number of messages to fetch (default: 50, max: 100)
 * @param before Cursor to get messages before (older messages)
 * @param after Cursor to get messages after (newer messages)
 */
export async function fetchMessagesPaginated(
	token: string,
	chatId: string,
	limit: number = 50,
	before?: string,
	after?: string
): Promise<PagedMessageResponse> {
	const params = new URLSearchParams();
	params.append('limit', limit.toString());

	if (before) {
		params.append('before', before);
	}

	if (after) {
		params.append('after', after);
	}

	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages?${params.toString()}`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch paginated messages: ${response.status}`);
	}

	return response.json();
}

export async function sendMessage(token: string, chatId: string, messageData: SendMessageRequest): Promise<Message> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(messageData)
	});

	if (!response.ok) {
		throw new Error(`Failed to send message: ${response.status}`);
	}

	return response.json();
}

export async function createInvitation(token: string, chatId: string): Promise<Invitation> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/invitations`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to create invitation: ${response.status}`);
	}

	return response.json();
}

export async function fetchInvitations(token: string, chatId: string): Promise<Invitation[]> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/invitations`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch invitations: ${response.status}`);
	}

	return response.json();
}

export async function redeemInvitation(token: string, invitationData: RedeemInvitationRequest): Promise<any> {
	const response = await fetch(`${CHAT_API_URL}/invitations/redeem`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(invitationData)
	});

	if (!response.ok) {
		throw new Error(`Failed to redeem invitation: ${response.status}`);
	}

	return response.json();
}

export async function deleteChat(token: string, chatId: string): Promise<void> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to delete chat: ${response.status}`);
	}
}
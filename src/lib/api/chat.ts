import type { Chat, CreateChatRequest, ChatsResponse, MessagesResponse, PagedMessageResponse, Message, SendMessageRequest, Invitation, RedeemInvitationRequest, ChatMetadata, ImageAttachment, FavoriteMessagesResponse, MessageReaction } from '../types/chat';
import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { authStore, refreshToken } from '../stores/auth';
import { redirectToLogin } from '../utils/authRedirect';
import { get } from 'svelte/store';

const CHAT_API_URL = `${PUBLIC_CHAT_API_URL || 'http://localhost:8080'}/api/chats`;
const IMAGE_API_URL = `${PUBLIC_CHAT_API_URL || 'http://localhost:8080'}/api/images`;

/**
 * A single 401 from the chat backend isn't reliable proof the session is
 * dead - it can happen from backend cold-start lag, clock skew, or a
 * transient auth hiccup on this specific request, especially right after
 * an Electron app cold start. Before wiping the session and bouncing the user
 * to the external login page, confirm with the auth server via
 * refreshToken() - which already distinguishes a genuinely rejected token
 * (401/403 -> logs out) from a transient failure (keeps the session), and
 * already de-duplicates concurrent calls. Only redirect if the session
 * actually ends up cleared.
 */
async function handleUnauthorized(response: Response): Promise<void> {
	if (response.status !== 401) return;

	await refreshToken();

	if (!get(authStore).token) {
		redirectToLogin();
	}
}

export async function fetchChats(token: string): Promise<ChatsResponse> {
	const response = await fetch(CHAT_API_URL, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to fetch chats: ${response.status}`);
	}

	return response.json();
}

export async function fetchChatMetadata(token: string, chatId: string): Promise<ChatMetadata> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/metadata`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to fetch chat metadata: ${response.status}`);
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
		await handleUnauthorized(response);
		throw new Error(`Failed to create chat: ${response.status}`);
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
		await handleUnauthorized(response);
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
		await handleUnauthorized(response);
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
		await handleUnauthorized(response);
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
		await handleUnauthorized(response);
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
		await handleUnauthorized(response);
		throw new Error(`Failed to redeem invitation: ${response.status}`);
	}

	return response.json();
}

export async function deleteMessage(token: string, chatId: string, messageId: string): Promise<void> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages/${messageId}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to delete message: ${response.status}`);
	}
}

export async function toggleMessageFavorite(token: string, chatId: string, messageId: string): Promise<void> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages/${messageId}/favorites`, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to toggle message favorite: ${response.status}`);
	}
}

export async function reactToMessage(token: string, chatId: string, messageId: string, reactionType?: 'FUNNY' | 'LIKE' | 'LOVE'): Promise<void> {
	const url = reactionType
		? `${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts?type=${reactionType}`
		: `${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts`;

	const response = await fetch(url, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to react to message: ${response.status}`);
	}
}

export async function fetchMessageReactions(token: string, chatId: string, messageId: string): Promise<MessageReaction[]> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to fetch message reactions: ${response.status}`);
	}

	return response.json();
}

// Fetch reactions for multiple messages at once
export async function fetchMultipleMessageReactions(token: string, chatId: string, messageIds: string[]): Promise<{ [messageId: string]: MessageReaction[] }> {
	const reactionPromises = messageIds.map(async (messageId) => {
		try {
			const reactions = await fetchMessageReactions(token, chatId, messageId);
			return { messageId, reactions };
		} catch (error) {
			console.warn(`Failed to fetch reactions for message ${messageId}:`, error);
			return { messageId, reactions: [] };
		}
	});

	const results = await Promise.all(reactionPromises);

	// Convert to object mapping messageId -> reactions
	const reactionMap: { [messageId: string]: MessageReaction[] } = {};
	for (const result of results) {
		reactionMap[result.messageId] = result.reactions;
	}

	return reactionMap;
}

export async function fetchFavoriteMessages(token: string, chatId: string): Promise<FavoriteMessagesResponse> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages/favorites`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to fetch favorite messages: ${response.status}`);
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
		await handleUnauthorized(response);
		throw new Error(`Failed to delete chat: ${response.status}`);
	}
}

export async function leaveChat(token: string, chatId: string, userId: string): Promise<void> {
	const response = await fetch(`${CHAT_API_URL}/${chatId}/members/${userId}/remove`, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to leave chat: ${response.status}`);
	}
}

// Image-related API functions

/**
 * Upload an image file to the server
 * @param token Bearer token for authentication
 * @param file Image file to upload
 * @returns Image attachment data with ID for referencing
 */
export async function uploadImage(token: string, file: File): Promise<ImageAttachment> {
	const formData = new FormData();
	formData.append('file', file);

	const response = await fetch(IMAGE_API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`
		},
		body: formData
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		if (response.status === 413) {
			throw new Error(`Failed to upload image: 413`);
		}
		throw new Error(`Failed to upload image: ${response.status}`);
	}

	return response.json();
}

/**
 * Get an image by ID
 * @param token Bearer token for authentication
 * @param imageId ID of the image to retrieve
 * @returns Image attachment data with base64 content
 */
export async function getImage(token: string, imageId: string): Promise<ImageAttachment> {
	const response = await fetch(`${IMAGE_API_URL}/${imageId}`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to get image: ${response.status}`);
	}

	return response.json();
}

/**
 * Send a message with optional image attachments
 * @param token Bearer token for authentication
 * @param chatId Chat ID to send message to
 * @param messageText Text content of the message
 * @param imageIds Array of uploaded image IDs to attach
 * @returns Sent message with attachments
 */
export async function sendMessageWithImages(
	token: string,
	chatId: string,
	messageText: string,
	imageIds: string[] = []
): Promise<Message> {
	// For now, we'll send the message with text and reference image IDs
	// The backend should handle associating the images with the message
	const messageData: SendMessageRequest & { imageIds?: string[] } = {
		message: messageText,
		...(imageIds.length > 0 && { imageIds })
	};

	const response = await fetch(`${CHAT_API_URL}/${chatId}/messages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(messageData)
	});

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`Failed to send message with images: ${response.status}`);
	}

	return response.json();
}
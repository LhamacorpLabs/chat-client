import type { Chat, CreateChatRequest, ChatsResponse, PagedMessageResponse, Message, SendMessageRequest, Invitation, RedeemInvitationRequest, ChatMetadata, ImageAttachment, FavoriteMessagesResponse, MessageReaction } from '../types/chat';
import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { authStore, refreshToken } from '../stores/auth';
import { redirectToLogin } from '../utils/authRedirect';
import { get } from 'svelte/store';

const CHAT_API_URL = `${PUBLIC_CHAT_API_URL || 'http://localhost:8080'}/api/chats`;
const IMAGE_API_URL = `${PUBLIC_CHAT_API_URL || 'http://localhost:8080'}/api/images`;

const DEFAULT_TIMEOUT_MS = 15000;

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

interface ApiFetchOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: BodyInit;
	/** Prefix used in the thrown error, e.g. "Failed to fetch chats" -> "Failed to fetch chats: 404" */
	errorMessage: string;
	timeoutMs?: number;
	/** Set false for endpoints with no response body (204s, PUT/DELETE acks). */
	parseJson?: boolean;
}

/**
 * Shared fetch wrapper for the chat/image API: attaches the bearer token,
 * enforces a timeout (a hung request used to never resolve or reject),
 * routes non-ok responses through handleUnauthorized, and throws a
 * consistently-formatted error. `errorMessage` intentionally stays a plain
 * caller-supplied prefix so existing `"<action>: <status>"` error strings
 * (asserted on in tests and matched on in the UI) don't change.
 */
async function apiFetch<T>(token: string, url: string, options: ApiFetchOptions): Promise<T> {
	const { method = 'GET', headers, body, errorMessage, timeoutMs = DEFAULT_TIMEOUT_MS, parseJson = true } = options;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: {
				'Authorization': `Bearer ${token}`,
				...headers
			},
			body,
			signal: controller.signal
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(`${errorMessage}: timed out`, { cause: error });
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}

	if (!response.ok) {
		await handleUnauthorized(response);
		throw new Error(`${errorMessage}: ${response.status}`);
	}

	if (!parseJson) {
		return undefined as T;
	}

	return response.json();
}

export async function fetchChats(token: string): Promise<ChatsResponse> {
	return apiFetch<ChatsResponse>(token, CHAT_API_URL, {
		errorMessage: 'Failed to fetch chats'
	});
}

export async function fetchChatMetadata(token: string, chatId: string): Promise<ChatMetadata> {
	return apiFetch<ChatMetadata>(token, `${CHAT_API_URL}/${chatId}/metadata`, {
		errorMessage: 'Failed to fetch chat metadata'
	});
}

export async function createChat(token: string, chatData: CreateChatRequest): Promise<Chat> {
	return apiFetch<Chat>(token, CHAT_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(chatData),
		errorMessage: 'Failed to create chat'
	});
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

	return apiFetch<PagedMessageResponse>(token, `${CHAT_API_URL}/${chatId}/messages?${params.toString()}`, {
		errorMessage: 'Failed to fetch paginated messages'
	});
}

export async function sendMessage(token: string, chatId: string, messageData: SendMessageRequest): Promise<Message> {
	return apiFetch<Message>(token, `${CHAT_API_URL}/${chatId}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(messageData),
		errorMessage: 'Failed to send message'
	});
}

export async function createInvitation(token: string, chatId: string): Promise<Invitation> {
	return apiFetch<Invitation>(token, `${CHAT_API_URL}/${chatId}/invitations`, {
		method: 'POST',
		errorMessage: 'Failed to create invitation'
	});
}

export async function redeemInvitation(token: string, invitationData: RedeemInvitationRequest): Promise<any> {
	return apiFetch<any>(token, `${CHAT_API_URL}/invitations/redeem`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(invitationData),
		errorMessage: 'Failed to redeem invitation'
	});
}

export async function deleteMessage(token: string, chatId: string, messageId: string): Promise<void> {
	return apiFetch<void>(token, `${CHAT_API_URL}/${chatId}/messages/${messageId}`, {
		method: 'DELETE',
		errorMessage: 'Failed to delete message',
		parseJson: false
	});
}

export async function toggleMessageFavorite(token: string, chatId: string, messageId: string): Promise<void> {
	return apiFetch<void>(token, `${CHAT_API_URL}/${chatId}/messages/${messageId}/favorites`, {
		method: 'PUT',
		errorMessage: 'Failed to toggle message favorite',
		parseJson: false
	});
}

export async function reactToMessage(token: string, chatId: string, messageId: string, reactionType?: 'FUNNY' | 'LIKE' | 'LOVE'): Promise<void> {
	const url = reactionType
		? `${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts?type=${reactionType}`
		: `${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts`;

	return apiFetch<void>(token, url, {
		method: 'PUT',
		errorMessage: 'Failed to react to message',
		parseJson: false
	});
}

export async function fetchMessageReactions(token: string, chatId: string, messageId: string): Promise<MessageReaction[]> {
	return apiFetch<MessageReaction[]>(token, `${CHAT_API_URL}/${chatId}/messages/${messageId}/reacts`, {
		errorMessage: 'Failed to fetch message reactions'
	});
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
	return apiFetch<FavoriteMessagesResponse>(token, `${CHAT_API_URL}/${chatId}/messages/favorites`, {
		errorMessage: 'Failed to fetch favorite messages'
	});
}

export async function deleteChat(token: string, chatId: string): Promise<void> {
	return apiFetch<void>(token, `${CHAT_API_URL}/${chatId}`, {
		method: 'DELETE',
		errorMessage: 'Failed to delete chat',
		parseJson: false
	});
}

export async function leaveChat(token: string, chatId: string, userId: string): Promise<void> {
	return apiFetch<void>(token, `${CHAT_API_URL}/${chatId}/members/${userId}/remove`, {
		method: 'PUT',
		errorMessage: 'Failed to leave chat',
		parseJson: false
	});
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

	return apiFetch<ImageAttachment>(token, IMAGE_API_URL, {
		method: 'POST',
		body: formData,
		errorMessage: 'Failed to upload image'
	});
}

/**
 * Get an image by ID
 * @param token Bearer token for authentication
 * @param imageId ID of the image to retrieve
 * @returns Image attachment data with base64 content
 */
export async function getImage(token: string, imageId: string): Promise<ImageAttachment> {
	return apiFetch<ImageAttachment>(token, `${IMAGE_API_URL}/${imageId}`, {
		errorMessage: 'Failed to get image'
	});
}

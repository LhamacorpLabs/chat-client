// Chat related types
export interface ChatMember {
	id: string;
	name: string;
}

export interface Chat {
	id: string;
	name: string;
	members: ChatMember[]; // Member objects with id and name
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	lastMessageAt: string | null; // Timestamp of the last message, null if no messages
}

export interface CreateChatRequest {
	name: string;
}

export interface ChatsResponse extends Array<Chat> {}

// Chat metadata response for efficient polling
export interface ChatMetadata {
	id: string;
	lastMessageAt: string | null;
}

// Message related types
export interface Message {
	id: string;
	chatId: string;
	userId: string;
	username: string;
	message: string;
	createdAt: string;
}

export interface MessagesResponse extends Array<Message> {}

export interface PagedMessageResponse {
	messages: Message[];
	nextCursor: string | null;      // Use this cursor to get older messages (before)
	prevCursor: string | null;      // Use this cursor to get newer messages (after)
	hasMore: boolean;               // True if there are more messages to load
}

export interface SendMessageRequest {
	message: string;
}

// Invitation related types
export interface Invitation {
	id: string;
	code: string;
	chatId: string;
	chatName: string;
	createdAt: string;
	status: string;
	createdBy: string;
	usedBy: string | null;
}

export interface RedeemInvitationRequest {
	code: string;
}
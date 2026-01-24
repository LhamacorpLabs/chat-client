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

// Image attachment types
export interface ImageMetadata {
	ContentType: string;
	filename: string;
}

export interface ImageAttachment {
	id: string;
	content?: string; // base64 content (optional, loaded on demand)
	metadata: ImageMetadata;
	createdBy: string;
	createdAt: string;
}

// Message related types
export interface Message {
	id: string;
	chatId: string;
	userId: string;
	username: string;
	message: string;
	images?: ImageAttachment[]; // Optional array of image attachments
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

// Favorite message related types
export interface FavoriteMessage {
	chatId: string;
	messageId: string;
	createdAt: string;
}

export interface FavoriteMessagesResponse extends Array<FavoriteMessage> {}
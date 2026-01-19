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
}

export interface CreateChatRequest {
	name: string;
}

export interface ChatsResponse extends Array<Chat> {}

// Message related types
export interface Message {
	id: string;
	chatId: string;
	userId: string;
	message: string;
	createdAt: string;
}

export interface MessagesResponse extends Array<Message> {}

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
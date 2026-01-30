import type { Message, MessageReaction, ReactionSummary, ReactionType } from '../types/chat';

/**
 * Merges all message reactions with messages to create reaction summaries
 * Groups reactions by type and counts users for each reaction type
 */
export function mergeMessagesWithReactions(
	messages: Message[],
	allReactions: MessageReaction[],
	chatMembers: { [userId: string]: string } = {} // userId -> username mapping
): Message[] {
	// Create a map of messageId -> reactions for that message
	const reactionsByMessage = new Map<string, MessageReaction[]>();

	for (const reaction of allReactions) {
		if (!reactionsByMessage.has(reaction.messageId)) {
			reactionsByMessage.set(reaction.messageId, []);
		}
		reactionsByMessage.get(reaction.messageId)!.push(reaction);
	}

	return messages.map(message => {
		const messageReactions = reactionsByMessage.get(message.id) || [];

		if (messageReactions.length === 0) {
			return {
				...message,
				reactions: []
			};
		}

		// Group reactions by type and count users
		const reactionGroups = new Map<ReactionType, { count: number; users: Array<{ userId: string; username: string }> }>();

		for (const reaction of messageReactions) {
			if (!reactionGroups.has(reaction.type)) {
				reactionGroups.set(reaction.type, { count: 0, users: [] });
			}

			const group = reactionGroups.get(reaction.type)!;
			group.count += 1;
			group.users.push({
				userId: reaction.userId,
				username: chatMembers[reaction.userId] || reaction.userId // fallback to userId if username not available
			});
		}

		// Convert to ReactionSummary array
		const reactionSummaries: ReactionSummary[] = Array.from(reactionGroups.entries()).map(
			([type, group]) => ({
				type,
				count: group.count,
				users: group.users
			})
		);

		return {
			...message,
			reactions: reactionSummaries
		};
	});
}

/**
 * Merges messages with per-message reaction data
 * Uses the new API structure where reactions are fetched per message
 */
export function mergeMessagesWithPerMessageReactions(
	messages: Message[],
	reactionsByMessage: { [messageId: string]: MessageReaction[] },
	chatMembers: { [userId: string]: string } = {}
): Message[] {
	return messages.map(message => {
		const messageReactions = reactionsByMessage[message.id] || [];

		if (messageReactions.length === 0) {
			return {
				...message,
				reactions: []
			};
		}

		// Group reactions by type and count users
		const reactionGroups = new Map<ReactionType, { count: number; users: Array<{ userId: string; username: string }> }>();

		for (const reaction of messageReactions) {
			if (!reactionGroups.has(reaction.type)) {
				reactionGroups.set(reaction.type, { count: 0, users: [] });
			}

			const group = reactionGroups.get(reaction.type)!;
			group.count += 1;
			group.users.push({
				userId: reaction.userId,
				username: chatMembers[reaction.userId] || reaction.userId // fallback to userId if username not available
			});
		}

		// Convert to ReactionSummary array
		const reactionSummaries: ReactionSummary[] = Array.from(reactionGroups.entries()).map(
			([type, group]) => ({
				type,
				count: group.count,
				users: group.users
			})
		);

		return {
			...message,
			reactions: reactionSummaries
		};
	});
}

/**
 * Gets the current user's reaction for a specific message
 */
export function getUserReactionForMessage(
	message: Message,
	currentUserId: string
): ReactionType | null {
	if (!message.reactions) return null;

	for (const reaction of message.reactions) {
		if (reaction.users.some(user => user.userId === currentUserId)) {
			return reaction.type;
		}
	}

	return null;
}

/**
 * Checks if a message has any reactions
 */
export function messageHasReactions(message: Message): boolean {
	return message.reactions != null && message.reactions.length > 0;
}
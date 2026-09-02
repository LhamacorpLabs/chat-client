import type { Message, MessageReaction, ReactionSummary, ReactionType } from '../types/chat';

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
 * Compares two messages' reaction summaries for equivalent content,
 * ignoring group/user ordering (which isn't guaranteed stable across
 * fetches since it falls out of Map iteration order).
 */
function reactionsEqual(a: ReactionSummary[] | undefined, b: ReactionSummary[] | undefined): boolean {
	const normalize = (reactions?: ReactionSummary[]) =>
		(reactions ?? [])
			.map(group => `${group.type}:${group.users.map(user => user.userId).sort().join(',')}`)
			.sort()
			.join('|');

	return normalize(a) === normalize(b);
}

/**
 * True if any message's reactions differ between the two lists (assumed to
 * be the same messages in the same order - e.g. before/after a reaction
 * refresh). Lets callers skip replacing the messages array, and the
 * re-renders and auto-scroll re-evaluation that go with it, when a poll
 * comes back with nothing new to show.
 */
export function messagesReactionsChanged(previous: Message[], next: Message[]): boolean {
	if (previous.length !== next.length) return true;
	return next.some((message, i) => !reactionsEqual(previous[i]?.reactions, message.reactions));
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
<script lang="ts">
	import type { Message, ReactionType, ReactionSummary } from '../types/chat';
	import { authStore } from '../stores/auth';
	import { getUserReactionForMessage, messageHasReactions } from '../utils/reactionUtils';

	interface Props {
		message: Message;
		isOwnMessage?: boolean;
		onReactionChange?: ((reactionType?: ReactionType) => Promise<void>) | null;
	}

	let { message, isOwnMessage = false, onReactionChange = null }: Props = $props();

	const reactionEmojis: Record<ReactionType, string> = {
		FUNNY: '😂',
		LIKE: '👍',
		LOVE: '❤️'
	};

	const reactionTypes: ReactionType[] = ['FUNNY', 'LIKE', 'LOVE'];

	let isUpdating = $state(false);

	let currentUserReaction = $derived(
		$authStore.user ? getUserReactionForMessage(message, $authStore.user.id) : null
	);
	let hasReactions = $derived(messageHasReactions(message));

	async function handleReactionClick(reactionType: ReactionType) {
		if (isUpdating || !onReactionChange) return;

		try {
			isUpdating = true;

			if (currentUserReaction === reactionType) {
				await onReactionChange();
			} else {
				await onReactionChange(reactionType);
			}
		} catch (error) {
			console.error('Failed to react to message:', error);
		} finally {
			isUpdating = false;
		}
	}
</script>

<div class="reactions-container" class:own-message={isOwnMessage} class:other-message={!isOwnMessage}>
	{#if hasReactions}
		<div class="reactions-display">
			{#each message.reactions as reaction (reaction.type)}
				<button
					class="reaction-button"
					class:user-reacted={currentUserReaction === reaction.type}
					class:updating={isUpdating}
					onclick={() => handleReactionClick(reaction.type)}
					disabled={isUpdating}
					title="{reaction.users.map(u => u.username).join(', ')}"
				>
					<span class="emoji">{reactionEmojis[reaction.type]}</span>
					<span class="count">{reaction.count}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="add-reactions">
		{#each reactionTypes as reactionType}
			{#if !message.reactions?.some(r => r.type === reactionType)}
				<button
					class="add-reaction-button"
					class:updating={isUpdating}
					onclick={() => handleReactionClick(reactionType)}
					disabled={isUpdating}
				>
					{reactionEmojis[reactionType]}
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.reactions-container {
		position: absolute;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
		pointer-events: none;
	}

	.reactions-container.own-message {
		bottom: -25px;
	}

	.reactions-container.other-message {
		bottom: -25px;
	}

	.reactions-container > * {
		pointer-events: auto;
	}

	.reactions-display {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.reaction-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		background: var(--bg-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 12px;
		min-height: 24px;
		color: var(--text-primary);
	}

	.reaction-button:hover {
		background: var(--bg-tertiary);
		transform: scale(1.05);
	}

	.reaction-button.user-reacted {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.reaction-button.user-reacted:hover {
		background: var(--accent-hover);
	}

	.reaction-button.updating {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.emoji {
		font-size: 14px;
		line-height: 1;
	}

	.count {
		font-size: 11px;
		font-weight: 500;
		min-width: 8px;
		text-align: center;
	}

	.add-reactions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	:global(.message-item:hover) .add-reactions {
		opacity: 1;
	}

	@media (hover: none) {
		.add-reactions {
			display: none;
		}
	}

	.add-reaction-button {
		padding: 2px 4px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s ease;
		min-height: 24px;
		min-width: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-reaction-button:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
		transform: scale(1.1);
	}

	.add-reaction-button.updating {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.reactions-container {
			position: static;
			margin-top: 4px;
		}

		.reaction-button {
			min-height: 28px;
			padding: 4px 8px;
		}

		.add-reaction-button {
			min-height: 28px;
			min-width: 28px;
		}
	}
</style>

<script lang="ts">
	import type { Message, ReactionType } from '../types/chat';
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

	let isUpdating = $state(false);

	let currentUserReaction = $derived(
		$authStore.user ? getUserReactionForMessage(message, $authStore.user.username) : null
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

<!-- Adding a new reaction happens from the message's hover toolbar (or
     the mobile action sheet); this row only shows existing reactions,
     each clickable to toggle your own. -->
{#if hasReactions}
	<div class="reactions-container" class:own-message={isOwnMessage}>
		{#each message.reactions as reaction (reaction.type)}
			<button
				class="reaction-button"
				class:user-reacted={currentUserReaction === reaction.type}
				class:updating={isUpdating}
				onclick={() => handleReactionClick(reaction.type)}
				disabled={isUpdating}
				title={reaction.users.map(u => u.username).join(', ')}
				aria-label={`${reaction.count} ${reaction.type.toLowerCase()} reaction${reaction.count === 1 ? '' : 's'}: ${reaction.users.map(u => u.username).join(', ')}`}
				aria-pressed={currentUserReaction === reaction.type}
			>
				<span class="emoji">{reactionEmojis[reaction.type]}</span>
				<span class="count">{reaction.count}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.reactions-container {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin-top: 4px;
		padding: 0 0.25rem;
	}

	.reactions-container.own-message {
		justify-content: flex-end;
	}

	.reaction-button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 8px 0 7px;
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-pill);
		background: var(--panel-bg);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
		color: var(--text-secondary);
		font-family: inherit;
	}

	.reaction-button:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: color-mix(in srgb, var(--text-muted) 50%, transparent);
	}

	.reaction-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.reaction-button.user-reacted {
		background: var(--accent-subtle);
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.reaction-button.updating {
		opacity: 0.6;
		cursor: progress;
	}

	.emoji {
		font-size: 13px;
		line-height: 1;
	}

	.count {
		font-size: 11.5px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>

<script lang="ts">
	import type { Message, ReactionType, ReactionSummary } from '../types/chat';
	import { authStore } from '../stores/auth';
	import { getUserReactionForMessage, messageHasReactions } from '../utils/reactionUtils';

	export let message: Message;
	export let isOwnMessage: boolean = false;
	export let onReactionChange: ((reactionType?: ReactionType) => Promise<void>) | null = null;

	const reactionEmojis: Record<ReactionType, string> = {
		FUNNY: '😂',
		LIKE: '👍',
		LOVE: '❤️'
	};

	const reactionTypes: ReactionType[] = ['FUNNY', 'LIKE', 'LOVE'];

	let isUpdating = false;

	function getUserReaction(): ReactionType | null {
		if (!$authStore.user) return null;
		return getUserReactionForMessage(message, $authStore.user.id);
	}

	async function handleReactionClick(reactionType: ReactionType) {
		if (isUpdating || !onReactionChange) return;

		const currentUserReaction = getUserReaction();

		try {
			isUpdating = true;

			// If user already has this reaction, remove it (pass undefined)
			// Otherwise, add/change to this reaction
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

	$: currentUserReaction = getUserReaction();
	$: hasReactions = messageHasReactions(message);
</script>

<div class="reactions-container" class:own-message={isOwnMessage} class:other-message={!isOwnMessage}>
	<!-- Existing reactions display -->
	{#if hasReactions}
		<div class="reactions-display">
			{#each message.reactions as reaction (reaction.type)}
				<button
					class="reaction-button"
					class:user-reacted={currentUserReaction === reaction.type}
					class:updating={isUpdating}
					on:click={() => handleReactionClick(reaction.type)}
					disabled={isUpdating}
					title="{reaction.users.map(u => u.username).join(', ')}"
				>
					<span class="emoji">{reactionEmojis[reaction.type]}</span>
					<span class="count">{reaction.count}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Add reaction buttons -->
	<div class="add-reactions">
		{#each reactionTypes as reactionType}
			{#if !message.reactions?.some(r => r.type === reactionType)}
				<button
					class="add-reaction-button"
					class:updating={isUpdating}
					on:click={() => handleReactionClick(reactionType)}
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
		border: 1px solid var(--border-color, #ddd);
		border-radius: 12px;
		background: var(--background-secondary, #f5f5f5);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 12px;
		min-height: 24px;
	}

	.reaction-button:hover {
		background: var(--background-hover, #e5e5e5);
		transform: scale(1.05);
	}

	.reaction-button.user-reacted {
		background: var(--accent-color, #007acc);
		color: white;
		border-color: var(--accent-color, #007acc);
	}

	.reaction-button.user-reacted:hover {
		background: var(--accent-color-dark, #005a99);
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
		visibility: hidden;
	}

	/* Use a more specific selector and ensure proper reset */
	:global(.message-item:hover) .add-reactions,
	:global(.message-item.hover-active) .add-reactions {
		opacity: 1;
		visibility: visible;
	}

	/* Force reset hover states when not hovering */
	:global(.message-item:not(:hover):not(.hover-active):not(.touch-active)) .add-reactions {
		opacity: 0;
		visibility: hidden;
	}

	/* Force hide on touch devices when not actively hovering */
	@media (hover: none) and (pointer: coarse) {
		.add-reactions {
			opacity: 0 !important;
			visibility: hidden !important;
			transition: opacity 0.1s ease, visibility 0.1s ease;
		}

		/* Only show on explicit tap/touch interaction */
		:global(.message-item.touch-active) .add-reactions {
			opacity: 1 !important;
			visibility: visible !important;
		}

		/* Ensure cleanup after touch ends */
		:global(.message-item:not(.touch-active)) .add-reactions {
			opacity: 0 !important;
			visibility: hidden !important;
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
		min-height: 20px;
		min-width: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-reaction-button:hover {
		background: var(--background-hover, #e5e5e5);
		border-color: var(--border-color, #ddd);
		transform: scale(1.1);
	}

	.add-reaction-button.updating {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Dark theme support */
	@media (prefers-color-scheme: dark) {
		.reaction-button {
			border-color: #444;
			background: #333;
			color: #fff;
		}

		.reaction-button:hover {
			background: #444;
		}

		.add-reaction-button:hover {
			background: #444;
			border-color: #555;
		}
	}
</style>
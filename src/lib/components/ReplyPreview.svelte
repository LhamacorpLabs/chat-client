<script lang="ts">
	import type { Message } from '$lib/types/chat';

	interface Props {
		message: Message | null;
		mode: 'composition' | 'display';
		onCancel?: (() => void) | undefined;
		onClick?: (() => void) | undefined;
		compact?: boolean;
	}

	let { message, mode, onCancel = undefined, onClick = undefined, compact = false }: Props = $props();

	function getPreviewText(msg: string | undefined): string {
		if (!msg) return '';
		// Remove reply: and image: lines from preview
		return msg
			.split('\n')
			.filter((line) => !line.trim().startsWith('reply:') && !line.trim().startsWith('image:'))
			.join(' ')
			.trim()
			.substring(0, 50);
	}

	function handleClick() {
		if (mode === 'display' && onClick) {
			onClick();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="reply-preview {mode}" class:compact onclick={handleClick} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()} role={mode === 'display' ? 'button' : 'region'} tabindex={mode === 'display' ? 0 : -1}>
	<div class="reply-indicator"></div>
	<div class="reply-content">
		<div class="reply-info">
			{#if message}
				<span class="reply-username">{#if mode === 'composition'}Replying to {/if}{message.username}</span>
				{#if message.message === '[deleted message]'}
					<span class="reply-text deleted">Original message deleted</span>
				{:else}
					<span class="reply-text">{getPreviewText(message.message)}</span>
				{/if}
			{:else}
				<span class="reply-text not-found">Message not found or not loaded</span>
			{/if}
		</div>
		{#if mode === 'composition' && onCancel}
			<button
				class="reply-cancel"
				onclick={(e) => {
					e.stopPropagation();
					onCancel();
				}}
				title="Cancel reply"
				aria-label="Cancel reply"
				type="button"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14" aria-hidden="true">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.reply-preview {
		display: flex;
		align-items: stretch;
		gap: 0.625rem;
		border-radius: var(--radius-sm);
		padding: 0.4375rem 0.625rem 0.4375rem 0.5rem;
	}

	.reply-preview.composition {
		background: var(--surface-hover);
	}

	/* Inside a message bubble: tint relative to the bubble's own text
	   color, so it reads correctly on both the neutral and the accent
	   bubble without a hard-coded surface. */
	.reply-preview.display {
		background: color-mix(in srgb, currentColor 9%, transparent);
		margin-bottom: 0.375rem;
		cursor: pointer;
		transition: background-color var(--duration-slow) var(--ease-standard);
	}

	.reply-preview.display:hover {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.reply-indicator {
		width: 3px;
		border-radius: 2px;
		background: var(--accent);
		flex-shrink: 0;
	}

	.reply-preview.display .reply-indicator {
		background: currentColor;
		opacity: 0.55;
	}

	.reply-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}

	.reply-info {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		min-width: 0;
		flex: 1;
		line-height: 1.35;
	}

	.reply-username {
		font-weight: 600;
		font-size: 0.8125rem;
	}

	.reply-preview.composition .reply-username {
		color: var(--accent);
	}

	.reply-text {
		font-size: 0.8125rem;
		opacity: 0.8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.reply-preview.composition .reply-text {
		color: var(--text-secondary);
		opacity: 1;
	}

	.reply-text.deleted,
	.reply-text.not-found {
		font-style: italic;
		opacity: 0.6;
	}

	.reply-cancel {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color var(--duration-base) ease, background-color var(--duration-base) ease;
	}

	.reply-cancel:hover {
		color: var(--text-primary);
		background: var(--surface-alt);
	}
</style>

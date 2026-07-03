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
				<span class="reply-username">{message.username}</span>
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
				type="button"
			>
				✕
			</button>
		{/if}
	</div>
</div>

<style>
	.reply-preview {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		border-radius: 6px;
		padding: 0.5rem;
	}

	.reply-preview.composition {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-light);
		margin-bottom: 0.5rem;
	}

	.reply-preview.display {
		background: var(--bg-secondary);
		cursor: pointer;
		transition: background var(--duration-slow) var(--ease-standard);
	}

	.reply-preview.display:hover {
		background: var(--bg-tertiary);
	}

	.reply-indicator {
		width: 3px;
		height: 100%;
		border-radius: 2px;
		background: var(--accent);
		flex-shrink: 0;
		min-height: 2rem;
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
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.reply-username {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.reply-text {
		font-size: 0.8rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.reply-text.deleted {
		color: var(--text-muted);
		font-style: italic;
	}

	.reply-text.not-found {
		color: var(--text-muted);
		font-style: italic;
	}

	.reply-cancel {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color var(--duration-slow) var(--ease-standard);
	}

	.reply-cancel:hover {
		color: var(--text-primary);
	}

	:global([data-theme='dark']) .reply-preview.display {
		background: var(--bg-glass);
	}

	:global([data-theme='dark']) .reply-preview.display:hover {
		background: var(--bg-glass-hover);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		onClose: () => void;
		maxWidth?: string;
		children?: Snippet;
	}

	let { title, onClose, maxWidth = '380px', children }: Props = $props();

	function stopPropagation(event: MouseEvent) {
		event.stopPropagation();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
	<div
		class="modal-content"
		style="max-width: {maxWidth}"
		onclick={stopPropagation}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
	>
		<div class="modal-header">
			<h3>{title}</h3>
			<button onclick={onClose} class="close-btn" type="button" aria-label="Close">&times;</button>
		</div>
		<div class="modal-body">
			{@render children?.()}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--space-4);
	}

	:global([data-theme='dark']) .modal-overlay {
		background: rgba(0, 0, 0, 0.6);
	}

	.modal-content {
		background: var(--panel-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		width: 100%;
		border: 1px solid var(--border);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-5) var(--space-6);
		border-bottom: 1px solid var(--border);
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--font-lg);
		font-weight: 700;
	}

	.close-btn {
		background: var(--input-bg);
		border: 1px solid var(--border);
		font-size: var(--font-lg);
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		flex-shrink: 0;
		transition: all var(--duration-slow) var(--ease-standard);
	}

	.close-btn:hover {
		background: var(--surface-hover);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.modal-body {
		padding: var(--space-6);
	}
</style>

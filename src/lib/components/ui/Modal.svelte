<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		onClose: () => void;
		maxWidth?: string;
		children?: Snippet;
	}

	let { title, description, onClose, maxWidth = '420px', children }: Props = $props();

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
			<div class="modal-heading">
				<h3>{title}</h3>
				{#if description}
					<p class="modal-subtitle">{description}</p>
				{/if}
			</div>
			<button onclick={onClose} class="close-btn" type="button" aria-label="Close">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" aria-hidden="true">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
		<div class="modal-body">
			{@render children?.()}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg, rgba(0, 0, 0, 0.5));
		-webkit-backdrop-filter: blur(4px);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--space-4);
		animation: overlayIn 0.18s ease-out;
	}

	@keyframes overlayIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		background: var(--panel-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		width: 100%;
		border: 1px solid var(--border-hover);
		animation: popIn 0.22s var(--ease-out-expo, ease-out);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-4);
		padding: 1.25rem 1.25rem 0 1.5rem;
	}

	.modal-heading {
		min-width: 0;
		padding-top: 0.25rem;
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.modal-subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background-color var(--duration-base) ease, color var(--duration-base) ease;
	}

	.close-btn:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.25rem 1.5rem 1.5rem;
	}

	@media (max-width: 480px) {
		.modal-overlay {
			align-items: flex-end;
			padding: 0;
		}

		.modal-content {
			max-width: 100% !important;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			border-bottom: none;
			padding-bottom: env(safe-area-inset-bottom);
			animation: sheetUp 0.28s var(--ease-out-expo, ease-out);
		}

		@keyframes sheetUp {
			from {
				transform: translateY(100%);
			}
			to {
				transform: translateY(0);
			}
		}
	}
</style>

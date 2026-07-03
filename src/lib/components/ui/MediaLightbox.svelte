<script lang="ts">
	interface Props {
		src: string;
		alt?: string;
		onClose: () => void;
	}

	let { src, alt = '', onClose }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function stopPropagation(event: MouseEvent) {
		event.stopPropagation();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="lightbox-overlay" onclick={onClose} role="button" tabindex="-1" aria-label="Close preview">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<img {src} {alt} class="lightbox-content" onclick={stopPropagation} />
	<div class="lightbox-close-hint">ESC or click to close</div>
</div>

<style>
	.lightbox-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		cursor: pointer;
		outline: none;
	}

	.lightbox-content {
		max-width: 95vw;
		max-height: 95vh;
		object-fit: contain;
		border-radius: var(--radius-md);
		cursor: default;
	}

	.lightbox-close-hint {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--font-xs);
		font-weight: 500;
		pointer-events: none;
		opacity: 0.8;
		transition: opacity var(--duration-slower) var(--ease-standard);
	}

	.lightbox-overlay:hover .lightbox-close-hint {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.lightbox-close-hint {
			top: 10px;
			right: 10px;
			font-size: 11px;
			padding: 6px 10px;
		}
	}
</style>

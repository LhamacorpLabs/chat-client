<script lang="ts">
	interface Props {
		src: string;
		alt?: string;
		/** Suggested file name for the download button. */
		filename?: string;
		onClose: () => void;
	}

	let { src, alt = '', filename, onClose }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function extensionFor(blob: Blob, url: string): string {
		const fromType = blob.type.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg');
		if (fromType) return fromType;
		const match = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i);
		return match ? match[1] : 'png';
	}

	async function download(event: MouseEvent) {
		event.stopPropagation();
		try {
			const blob = await (await fetch(src)).blob();
			const objectUrl = URL.createObjectURL(blob);
			const name = filename || `${alt || 'image'}.${extensionFor(blob, src)}`;
			const link = document.createElement('a');
			link.href = objectUrl;
			link.download = name;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		} catch {
			// Cross-origin sources without CORS can't be fetched - fall back to opening them.
			window.open(src, '_blank', 'noopener');
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
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<img {src} {alt} class="lightbox-content" onclick={stopPropagation} />
	<button class="lightbox-download" type="button" onclick={download} aria-label="Download image">
		Download
	</button>
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
		border-radius: var(--radius-pill);
		font-size: var(--font-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		pointer-events: none;
		opacity: 0.8;
		transition: opacity var(--duration-slower) var(--ease-standard);
	}

	.lightbox-download {
		position: absolute;
		top: 20px;
		left: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-pill);
		font-size: var(--font-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		opacity: 0.8;
	}

	.lightbox-download:hover {
		opacity: 1;
	}

	.lightbox-overlay:hover .lightbox-close-hint {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.lightbox-download {
			top: 10px;
			left: 10px;
			font-size: 11px;
			padding: 6px 10px;
		}

		.lightbox-close-hint {
			top: 10px;
			right: 10px;
			font-size: 11px;
			padding: 6px 10px;
		}
	}
</style>

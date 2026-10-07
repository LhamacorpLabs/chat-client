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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="lightbox-frame" onclick={stopPropagation}>
		<img {src} {alt} class="lightbox-content" />
		<div class="lightbox-actions">
			<button class="lightbox-btn" type="button" onclick={download} aria-label="Download image" title="Download">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 3v12" />
					<path d="m7 11 5 5 5-5" />
					<path d="M5 21h14" />
				</svg>
			</button>
			<button class="lightbox-btn" type="button" onclick={onClose} aria-label="Close preview" title="Close">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M6 6l12 12" />
					<path d="M18 6 6 18" />
				</svg>
			</button>
		</div>
	</div>
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

	.lightbox-frame {
		position: relative;
		display: flex;
		cursor: default;
	}

	.lightbox-content {
		max-width: 95vw;
		max-height: 95vh;
		object-fit: contain;
		border-radius: var(--radius-md);
		display: block;
	}

	.lightbox-actions {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 8px;
	}

	.lightbox-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		cursor: pointer;
		opacity: 0.85;
		transition: opacity var(--duration-slower) var(--ease-standard);
	}

	.lightbox-btn:hover,
	.lightbox-btn:focus-visible {
		opacity: 1;
		background: rgba(0, 0, 0, 0.85);
	}
</style>

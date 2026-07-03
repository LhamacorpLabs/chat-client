<script lang="ts">
	import type { ImageAttachment } from '../types/chat';
	import { getImage } from '../api/chat';
	import { authStore } from '../stores/auth';
	import MediaLightbox from './ui/MediaLightbox.svelte';
	import LoadingSpinner from './ui/LoadingSpinner.svelte';

	interface Props {
		attachment: ImageAttachment;
		isLoading?: boolean;
	}

	let { attachment, isLoading = false }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);
	let fullImageData = $state<ImageAttachment | null>(null);
	let showLightbox = $state(false);

	// Load full image data if not already present
	async function loadFullImage() {
		if (!$authStore.token || attachment.content || fullImageData) return;

		try {
			isLoading = true;
			const imageData = await getImage($authStore.token, attachment.id);
			fullImageData = imageData;
			imageLoaded = true;
		} catch (error) {
			console.error('Failed to load image:', error);
			imageError = true;
		} finally {
			isLoading = false;
		}
	}

	// Determine the image source
	$effect(() => {
		if (attachment.content) {
			// Image content already loaded
			imageLoaded = true;
		} else if (!fullImageData && !isLoading && !imageError) {
			// Load image on component mount
			loadFullImage();
		}
	});

	function getImageSrc(): string {
		const content = attachment.content || fullImageData?.content;
		if (!content) return '';

		// Check if content already includes data URL prefix
		if (content.startsWith('data:')) {
			return content;
		}

		// Add data URL prefix based on content type
		const mimeType = attachment.metadata.ContentType || 'image/jpeg';
		return `data:${mimeType};base64,${content}`;
	}

	function openLightbox() {
		showLightbox = true;
	}
</script>

<div class="message-image-container">
	{#if imageError}
		<div class="image-error">
			<span class="error-icon">🖼️</span>
			<span class="error-text">Failed to load image</span>
			<span class="filename">{attachment.metadata.filename}</span>
		</div>
	{:else if isLoading || !imageLoaded}
		<div class="image-loading">
			<LoadingSpinner size="sm" />
			<span class="loading-text">Loading image...</span>
			<span class="filename">{attachment.metadata.filename}</span>
		</div>
	{:else}
		<button class="image-wrapper" onclick={openLightbox} type="button">
			<img
				src={getImageSrc()}
				alt={attachment.metadata.filename}
				class="message-image"
				loading="lazy"
			/>
			<div class="image-overlay">
			</div>
		</button>
	{/if}
</div>

{#if showLightbox}
	<MediaLightbox src={getImageSrc()} alt={attachment.metadata.filename} onClose={() => showLightbox = false} />
{/if}

<style>
	.message-image-container {
		margin: 8px 0;
	}

	.image-wrapper {
		position: relative;
		display: inline-block;
		max-width: 300px;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: transform 0.2s ease;
		border: none;
		padding: 0;
		background: none;
	}

	.image-wrapper:hover {
		transform: scale(1.02);
	}

	.message-image {
		width: 100%;
		height: auto;
		max-height: 250px;
		object-fit: cover;
		display: block;
	}

	.image-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.image-wrapper:hover .image-overlay {
		opacity: 1;
	}

	.image-loading, .image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px dashed var(--border-color);
		max-width: 200px;
	}

	.error-icon {
		font-size: 24px;
		margin-bottom: 8px;
	}

	.loading-text, .error-text {
		font-size: 12px;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.filename {
		font-size: 11px;
		color: var(--text-muted);
		text-align: center;
		word-break: break-all;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.image-wrapper {
			max-width: 250px;
		}

		.message-image {
			max-height: 200px;
		}
	}

	@media (max-width: 480px) {
		.image-wrapper {
			max-width: 200px;
		}

		.message-image {
			max-height: 150px;
		}
	}
</style>
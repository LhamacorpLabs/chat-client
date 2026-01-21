<script lang="ts">
	import type { ImageAttachment } from '../types/chat';
	import { getImage } from '../api/chat';
	import { authStore } from '../stores/auth';

	interface Props {
		attachment: ImageAttachment;
		isLoading?: boolean;
	}

	let { attachment, isLoading = false }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);
	let fullImageData = $state<ImageAttachment | null>(null);

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

	function openImageModal() {
		// Create modal to display full-size image
		const modal = document.createElement('div');
		modal.className = 'image-modal-overlay';
		modal.tabIndex = -1; // Make focusable for keyboard events

		const img = document.createElement('img');
		img.src = getImageSrc();
		img.className = 'image-modal-content';
		img.onclick = (e) => e.stopPropagation();

		// Function to close modal and cleanup
		function closeModal() {
			modal.remove();
			document.removeEventListener('keydown', handleKeyDown);
		}

		// Handle keydown events (ESC to close)
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeModal();
			}
		}

		// Set up event listeners
		modal.onclick = closeModal;
		document.addEventListener('keydown', handleKeyDown);

		// Add close hint
		const closeHint = document.createElement('div');
		closeHint.className = 'esc-hint';
		closeHint.textContent = 'ESC or click to close';

		modal.appendChild(img);
		modal.appendChild(closeHint);
		document.body.appendChild(modal);

		// Focus the modal for better accessibility
		modal.focus();
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
			<div class="loading-spinner"></div>
			<span class="loading-text">Loading image...</span>
			<span class="filename">{attachment.metadata.filename}</span>
		</div>
	{:else}
		<div class="image-wrapper" onclick={openImageModal}>
			<img
				src={getImageSrc()}
				alt={attachment.metadata.filename}
				class="message-image"
				loading="lazy"
			/>
			<div class="image-overlay">
			</div>
		</div>
	{/if}
</div>

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
		background: var(--color-background-secondary, #f5f5f5);
		border-radius: 8px;
		border: 1px dashed var(--color-border, #ccc);
		max-width: 200px;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-border, #ccc);
		border-top: 2px solid var(--color-primary, #007bff);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 8px;
	}

	.error-icon {
		font-size: 24px;
		margin-bottom: 8px;
	}

	.loading-text, .error-text {
		font-size: 12px;
		color: var(--color-text-secondary, #666);
		margin-bottom: 4px;
	}

	.filename {
		font-size: 11px;
		color: var(--color-text-muted, #999);
		text-align: center;
		word-break: break-all;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Modal styles */
	:global(.image-modal-overlay) {
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

	:global(.image-modal-content) {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 8px;
		cursor: default;
	}

	:global(.esc-hint) {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		pointer-events: none;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	:global(.image-modal-overlay:hover .esc-hint) {
		opacity: 1;
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

		:global(.esc-hint) {
			top: 10px;
			right: 10px;
			font-size: 11px;
			padding: 6px 10px;
		}
	}
</style>
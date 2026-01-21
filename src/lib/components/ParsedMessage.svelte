<script lang="ts">
	import { parseImageMessage, type ParsedMessage } from '../utils/imageMessages';
	import MessageImage from './MessageImage.svelte';
	import { getImage } from '../api/chat';
	import { authStore } from '../stores/auth';
	import type { ImageAttachment } from '../types/chat';

	interface Props {
		content: string;
	}

	let { content }: Props = $props();

	// Parse message content (derived, no side effects)
	let parsedMessage = $derived(parseImageMessage(content));

	// State for image loading - keyed by content to avoid loops
	let loadState = $state<{
		content: string;
		loadedImages: (ImageAttachment | null)[];
		loadingImages: boolean;
		hasLoadedOnce: boolean;
		loadingFailed: boolean;
	}>({
		content: '',
		loadedImages: [],
		loadingImages: false,
		hasLoadedOnce: false,
		loadingFailed: false
	});

	// Only trigger effect when content actually changes
	$effect(() => {
		if (loadState.content !== content) {
			// Content changed, reset state and load images
			loadState = {
				content,
				loadedImages: [],
				loadingImages: false,
				hasLoadedOnce: false,
				loadingFailed: false
			};

			// Load images if we have any
			if (parsedMessage.imageIds.length > 0) {
				loadImages();
			}
		}
	});

	async function loadImages() {
		if (!$authStore.token || parsedMessage.imageIds.length === 0 || loadState.hasLoadedOnce) return;

		loadState.hasLoadedOnce = true;
		loadState.loadingImages = true;
		loadState.loadingFailed = false;

		try {
			const imagePromises = parsedMessage.imageIds.map(async (imageId) => {
				try {
					return await getImage($authStore.token!, imageId);
				} catch (error) {
					console.warn('Failed to load image:', imageId, error);
					return null;
				}
			});

			const images = await Promise.all(imagePromises);
			loadState.loadedImages = images;

			// If all images failed to load, mark as failed
			const hasAnyValidImages = images.some(img => img !== null);
			if (!hasAnyValidImages) {
				loadState.loadingFailed = true;
			}

		} catch (error) {
			console.error('Failed to load images:', error);
			loadState.loadedImages = parsedMessage.imageIds.map(() => null);
			loadState.loadingFailed = true;
		} finally {
			loadState.loadingImages = false;
		}
	}
</script>

{#if loadState.loadingFailed}
	<!-- Fallback: display original message as-is when loading failed -->
	<div class="message-text">
		{content}
	</div>
{:else}
	<!-- Normal parsed message display -->

	<!-- Render text content if any -->
	{#if parsedMessage.text}
		<div class="message-text">
			{parsedMessage.text}
		</div>
	{/if}

	<!-- Render images -->
	{#if parsedMessage.imageIds.length > 0}
		<div class="message-images">
			{#if loadState.loadingImages}
				{#each parsedMessage.imageIds as imageId}
					<div class="image-loading">
						<div class="loading-spinner"></div>
						<span class="loading-text">Loading image...</span>
					</div>
				{/each}
			{:else}
				{#each loadState.loadedImages as image, index}
					{#if image}
						<MessageImage attachment={image} />
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
{/if}

<style>
	.message-text {
		margin-bottom: 8px;
	}

	.message-images {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}

	.image-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		background: var(--color-background-secondary, #f5f5f5);
		border-radius: 8px;
		border: 1px dashed var(--color-border, #ccc);
		min-width: 120px;
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-border, #ccc);
		border-top: 2px solid var(--color-primary, #007bff);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 8px;
	}

	.loading-text {
		font-size: 12px;
		color: var(--color-text-secondary, #666);
	}

	.image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		background: var(--color-error-background, #f8d7da);
		border-radius: 8px;
		border: 1px dashed var(--color-error-border, #f5c6cb);
		min-width: 120px;
	}

	.error-icon {
		font-size: 24px;
		margin-bottom: 8px;
	}

	.error-text {
		font-size: 12px;
		color: var(--color-error-text, #721c24);
		margin-bottom: 4px;
	}

	.image-id {
		font-size: 10px;
		color: var(--color-text-muted, #999);
		font-family: monospace;
		text-align: center;
		word-break: break-all;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>
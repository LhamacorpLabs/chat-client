<script lang="ts">
	import { parseImageMessage, type ParsedMessage } from '../utils/imageMessages';
	import { parseReplyMessage } from '../utils/replyMessages';
	import { linkify } from '../utils/linkify';
	import MessageImage from './MessageImage.svelte';
	import ReplyPreview from './ReplyPreview.svelte';
	import LoadingSpinner from './ui/LoadingSpinner.svelte';
	import { getImage } from '../api/chat';
	import { authStore } from '../stores/auth';
	import type { ImageAttachment, Message } from '../types/chat';

	interface Props {
		content: string;
		messages?: Message[];
		onReplyClick?: (messageId: string) => void;
	}

	let { content, messages = [], onReplyClick }: Props = $props();

	// Parse message content (derived, no side effects)
	let parsedMessage = $derived(parseImageMessage(content));
	let parsedReply = $derived(parseReplyMessage(content));
	let repliedMessage = $derived(
		parsedReply.replyToId ? messages.find((m) => m.id === parsedReply.replyToId) : null
	);
	// Apply linkify to reply text for emoji translation and link processing
	let processedReplyText = $derived(
		parsedReply.text ? linkify(parsedReply.text) : ''
	);
	// Process fallback content as well
	let processedFallbackContent = $derived(linkify(content));

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
			if (parsedReply.imageIds.length > 0) {
				loadImages();
			}
		}
	});

	async function loadImages() {
		if (!$authStore.token || parsedReply.imageIds.length === 0 || loadState.hasLoadedOnce) return;

		loadState.hasLoadedOnce = true;
		loadState.loadingImages = true;
		loadState.loadingFailed = false;

		try {
			const imagePromises = parsedReply.imageIds.map(async (imageId) => {
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
			loadState.loadedImages = parsedReply.imageIds.map(() => null);
			loadState.loadingFailed = true;
		} finally {
			loadState.loadingImages = false;
		}
	}
</script>

{#if loadState.loadingFailed}
	<!-- Fallback: display processed message when loading failed -->
	<div class="message-text">
		{@html processedFallbackContent}
	</div>
{:else}
	<!-- Normal parsed message display -->

	<!-- Render reply preview if this is a reply -->
	{#if parsedReply.replyToId}
		<ReplyPreview
			message={repliedMessage ?? null}
			mode="display"
			onClick={() => onReplyClick?.(parsedReply.replyToId!)}
		/>
	{/if}

	<!-- Render text content if any -->
	{#if parsedReply.text}
		<div class="message-text">
			{@html processedReplyText}
		</div>
	{/if}

	<!-- Render images -->
	{#if parsedReply.imageIds.length > 0}
		<div class="message-images">
			{#if loadState.loadingImages}
				{#each parsedReply.imageIds as imageId}
					<div class="image-loading">
						<LoadingSpinner size="sm" label="Loading image..." />
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
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
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
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px dashed var(--border-color);
		min-width: 120px;
	}
</style>
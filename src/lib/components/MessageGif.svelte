<script lang="ts">
	import type { GifLink } from '../utils/linkify';
	import MediaLightbox from './ui/MediaLightbox.svelte';
	import LoadingSpinner from './ui/LoadingSpinner.svelte';

	interface Props {
		gif: GifLink;
	}

	let { gif }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);
	let showLightbox = $state(false);

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleImageError() {
		imageError = true;
	}

	function openLightbox() {
		showLightbox = true;
	}
</script>

<div class="message-gif-container">
	{#if imageError}
		<div class="gif-error">
			<div class="error-content">
				<span class="error-icon">🎞️</span>
				<span class="error-text">Failed to load GIF</span>
				<a href={gif.url} target="_blank" rel="noopener noreferrer" class="gif-link">
					{gif.url}
				</a>
			</div>
		</div>
	{:else}
		<button class="gif-wrapper" onclick={openLightbox} type="button">
			<img
				src={gif.url}
				alt="GIF"
				class="message-gif {imageLoaded ? 'loaded' : 'loading'}"
				onload={handleImageLoad}
				onerror={handleImageError}
				loading="lazy"
			/>
			{#if !imageLoaded}
				<div class="gif-loading-overlay">
					<LoadingSpinner size="sm" label="Loading GIF..." />
				</div>
			{/if}
			{#if gif.isGif}
				<div class="gif-overlay">
					<div class="gif-indicator">GIF</div>
				</div>
			{/if}
		</button>
	{/if}
</div>

{#if showLightbox}
	<MediaLightbox src={gif.url} alt="GIF" onClose={() => showLightbox = false} />
{/if}

<style>
	.message-gif-container {
		margin: 8px 0;
	}

	.gif-wrapper {
		position: relative;
		display: inline-block;
		max-width: 400px;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: transform 0.2s ease;
		border: none;
		padding: 0;
		background: none;
	}

	.gif-wrapper:hover {
		transform: scale(1.02);
	}

	.message-gif {
		width: 100%;
		height: auto;
		max-height: 300px;
		object-fit: cover;
		display: block;
		transition: opacity 0.3s ease;
	}

	.message-gif.loading {
		opacity: 0;
	}

	.message-gif.loaded {
		opacity: 1;
	}

	.gif-loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--bg-secondary);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 150px;
	}

	.gif-overlay {
		position: absolute;
		bottom: 8px;
		right: 8px;
		opacity: 0.9;
		transition: opacity 0.2s ease;
	}

	.gif-wrapper:hover .gif-overlay {
		opacity: 1;
	}

	.gif-indicator {
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: bold;
		letter-spacing: 0.5px;
	}

	.gif-error {
		background: var(--danger-subtle);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 8px;
		padding: 16px;
		max-width: 300px;
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.error-icon {
		font-size: 24px;
		margin-bottom: 8px;
	}

	.error-text {
		font-size: 12px;
		color: var(--danger);
		margin-bottom: 8px;
		font-weight: 500;
	}

	.gif-link {
		font-size: 11px;
		color: var(--accent);
		text-decoration: underline;
		word-break: break-all;
		line-height: 1.3;
	}

	.gif-link:hover {
		color: var(--accent-hover);
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.gif-wrapper {
			max-width: 300px;
		}

		.message-gif {
			max-height: 250px;
		}
	}

	@media (max-width: 480px) {
		.gif-wrapper {
			max-width: 250px;
		}

		.message-gif {
			max-height: 200px;
		}
	}
</style>
<script lang="ts">
	import type { GifLink } from '../utils/linkify';

	interface Props {
		gif: GifLink;
	}

	let { gif }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleImageError() {
		imageError = true;
	}

	async function openLink(event: MouseEvent) {
		// window.open()/target=_blank don't reliably open the OS browser inside
		// the Tauri webview, so route through the opener plugin there.
		if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
			event.preventDefault();
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(gif.url);
		}
	}

	function openGifModal() {
		// Create modal to display full-size GIF
		const modal = document.createElement('div');
		modal.className = 'gif-modal-overlay';
		modal.tabIndex = -1;

		const img = document.createElement('img');
		img.src = gif.url;
		img.className = 'gif-modal-content';
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

		// Add close hint
		const closeHint = document.createElement('div');
		closeHint.className = 'gif-close-hint';
		closeHint.textContent = 'ESC or click to close';

		// Set up event listeners
		modal.onclick = closeModal;
		document.addEventListener('keydown', handleKeyDown);

		modal.appendChild(img);
		modal.appendChild(closeHint);
		document.body.appendChild(modal);

		// Focus the modal for better accessibility
		modal.focus();
	}
</script>

<div class="message-gif-container">
	{#if imageError}
		<div class="gif-error">
			<div class="error-content">
				<span class="error-icon">🎞️</span>
				<span class="error-text">Failed to load GIF</span>
				<a href={gif.url} target="_blank" rel="noopener noreferrer" class="gif-link" onclick={openLink}>
					{gif.url}
				</a>
			</div>
		</div>
	{:else}
		<button class="gif-wrapper" onclick={openGifModal} type="button">
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
					<div class="loading-spinner"></div>
					<span class="loading-text">Loading GIF...</span>
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
		background: var(--color-background-secondary, #f5f5f5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 150px;
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

	.loading-text {
		font-size: 12px;
		color: var(--color-text-secondary, #666);
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
		background: var(--color-error-background, #f8d7da);
		border: 1px solid var(--color-error-border, #f5c6cb);
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
		color: var(--color-error-text, #721c24);
		margin-bottom: 8px;
		font-weight: 500;
	}

	.gif-link {
		font-size: 11px;
		color: var(--color-primary, #007bff);
		text-decoration: underline;
		word-break: break-all;
		line-height: 1.3;
	}

	.gif-link:hover {
		color: var(--color-primary-dark, #0056b3);
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Modal styles */
	:global(.gif-modal-overlay) {
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

	:global(.gif-modal-content) {
		max-width: 95vw;
		max-height: 95vh;
		object-fit: contain;
		border-radius: 8px;
		cursor: default;
	}

	:global(.gif-close-hint) {
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

	:global(.gif-modal-overlay:hover .gif-close-hint) {
		opacity: 1;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.gif-wrapper {
			max-width: 300px;
		}

		.message-gif {
			max-height: 250px;
		}

		:global(.gif-close-hint) {
			top: 10px;
			right: 10px;
			font-size: 11px;
			padding: 6px 10px;
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
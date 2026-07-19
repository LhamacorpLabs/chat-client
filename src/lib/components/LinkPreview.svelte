<script lang="ts">
	import type { LinkPreview } from '$lib/utils/linkPreview';

	interface Props {
		preview: LinkPreview;
		onLinkClick?: (url: string) => void;
	}

	let { preview, onLinkClick }: Props = $props();

	// List of trusted platforms that don't need confirmation
	const trustedPlatforms = ['youtube', 'instagram', 'spotify', 'twitter', 'github', 'amazon', 'lhamacorp'];

	async function openExternalLink(url: string) {
		try {
			// The Electron main process intercepts window.open() and routes it
			// to the OS browser, so this works the same in the desktop build
			// and on the web.
			window.open(url, '_blank', 'noopener,noreferrer');
		} catch (error) {
			// Don't let this fail silently - fall back to the confirmation
			// flow (which surfaces an error toast) so the user gets some
			// feedback instead of the click appearing to do nothing.
			console.error('Failed to open link:', error);
			onLinkClick?.(url);
		}
	}

	function handleClick() {
		// Skip confirmation for trusted platforms and open directly
		if (trustedPlatforms.includes(preview.platform)) {
			openExternalLink(preview.url);
		} else if (onLinkClick) {
			onLinkClick(preview.url);
		}
	}

	function getPlatformLogo(platform: string) {
		switch (platform) {
			case 'youtube':
				return `<svg width="20" height="14" viewBox="0 0 24 18" fill="currentColor">
					<path d="M23.498 4.005c-.265-1.025-1.078-1.838-2.103-2.103C19.507 1.5 12 1.5 12 1.5s-7.507 0-9.395.402C1.58 2.167.767 2.98.502 4.005 .1 5.893.1 9.75.1 9.75s0 3.857.402 5.745c.265 1.025 1.078 1.838 2.103 2.103C4.493 17.9 12 17.9 12 17.9s7.507 0 9.395-.402c1.025-.265 1.838-1.078 2.103-2.103.402-1.888.402-5.745.402-5.745s0-3.857-.402-5.745zM9.75 12.908V6.592L15.5 9.75 9.75 12.908z"/>
				</svg>`;
			case 'instagram':
				return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<rect x="3" y="3" width="18" height="18" rx="6" ry="6" fill="currentColor"/>
					<circle cx="12" cy="12" r="5" fill="none" stroke="white" stroke-width="2"/>
					<circle cx="17" cy="7" r="1.5" fill="white"/>
				</svg>`;
			case 'spotify':
				return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15.06 10.56 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.32 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
				</svg>`;
			case 'twitter':
				return `<svg width="20" height="16" viewBox="0 0 24 19" fill="currentColor">
					<path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
				</svg>`;
			case 'github':
				return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
				</svg>`;
			case 'amazon':
				return `<svg width="20" height="16" viewBox="0 0 24 18" fill="currentColor">
					<path d="M.045 15.514c2.55 1.94 6.242 2.97 9.422 2.97 4.462 0 8.482-1.653 11.524-4.397.342-.308.037-.728-.374-.49-4.695 2.734-10.506 4.38-16.51 4.38-4.063 0-8.524-1.09-11.824-2.844-.55-.293-1.01.362-.238.381zm1.264-1.44c-.326-.417-2.157-.197-2.98-.099-.251.03-.29-.188-.063-.346 1.457-1.026 3.848-.73 4.125-.387.278.345-.074 2.735-1.438 3.874-.209.174-.408.081-.315-.149.304-.757.985-2.454.67-2.893zm20.825-8.18v-.69c0-.103-.08-.173-.173-.173h-3.098c-.098 0-.178.075-.178.173v.59c0 .098.085.228.178.318l1.603 1.454c1.017.918 1.362 1.56 1.362 2.49v2.473c0 1.362-.347 2.09-.347 2.09.013.08.045.122.138.122h1.785c.093 0 .17-.041.18-.122 0 0-.36-.728-.36-2.09v-2.473c0-.93.345-1.572 1.362-2.49l1.603-1.454c.093-.09.178-.22.178-.318zm-9.32-4.353c-2.473 0-3.662 1.89-3.662 4.353 0 2.346 1.07 4.225 3.662 4.225s3.662-1.879 3.662-4.225c0-2.462-1.189-4.353-3.662-4.353zm0 6.89c-1.07 0-1.189-1.454-1.189-2.537 0-1.083.119-2.654 1.189-2.654s1.189 1.571 1.189 2.654c0 1.083-.119 2.537-1.189 2.537z"/>
					<path d="M8.85 14.92c-3.54 2.61-8.68 4-13.07 4-.95 0-1.72-.51-1.72-1.14 0-.68.46-1.03.88-1.33.89-.71 2.35-.96 3.54-.96 1.78 0 3.31.36 4.76 1.07l-.15-2.77c0-1.18-.89-2.14-2.07-2.14-.95 0-1.78.36-2.37.95-.1.1-.2.15-.35.15-.2 0-.35-.15-.35-.35v-.2c0-.15.1-.3.25-.4.79-.79 2.07-1.33 3.42-1.33 1.93 0 3.46 1.33 3.46 3.26v5.66c0 .2-.15.35-.35.35-.15 0-.3-.1-.35-.25l-.35-1.47z"/>
				</svg>`;
			case 'lhamacorp':
				return `<img src="/logo.png" width="20" height="20" alt="LhamaCorp" style="object-fit: contain;">`;
			default:
				return '';
		}
	}
</script>

<div
	class="link-preview-card {preview.platform}"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
	<div class="preview-content">
		<div class="platform-header">
			<div class="platform-logo" style="color: {preview.color}">
				{@html getPlatformLogo(preview.platform)}
			</div>
			<div class="platform-info">
				<div class="platform-name">{preview.platform.charAt(0).toUpperCase() + preview.platform.slice(1)}</div>
				<div class="content-type">{preview.contentType || 'Link'}</div>
			</div>
		</div>

		<div class="preview-body">
			<div class="content-title">{preview.title}</div>
			{#if preview.description}
				<div class="content-description">{preview.description}</div>
			{/if}
			<div class="content-url">{new URL(preview.url).hostname}</div>
		</div>
	</div>

	<div class="preview-accent" style="background: {preview.color}"></div>
</div>

<style>
	.link-preview-card {
		position: relative;
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 12px;
		margin-top: 0.75rem;
		cursor: pointer;
		transition: all 0.3s ease;
		max-width: 450px;
		overflow: hidden;
	}

	.link-preview-card:hover {
		border-color: var(--border-color);
		background: var(--bg-tertiary, var(--bg-secondary));
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
	}

	.link-preview-card:focus {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.preview-accent {
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		opacity: 0.8;
	}

	.preview-content {
		padding: 1rem 1rem 1rem 1.25rem;
	}

	.platform-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.platform-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--bg-tertiary);
		border-radius: 8px;
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.link-preview-card:hover .platform-logo {
		transform: scale(1.1);
	}

	.platform-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.platform-name {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-primary);
		text-transform: capitalize;
	}

	.content-type {
		font-size: 0.75rem;
		color: var(--text-secondary);
		opacity: 0.8;
	}

	.preview-body {
		padding-left: 0.5rem;
	}

	.content-title {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text-primary);
		line-height: 1.3;
		margin-bottom: 0.5rem;
		word-break: break-word;
	}

	.content-description {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 0.5rem;
		word-break: break-word;
		opacity: 0.9;
	}

	.content-url {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
		opacity: 0.7;
		text-transform: lowercase;
	}

	/* Platform-specific styling */
	.link-preview-card.youtube .platform-logo {
		background: rgba(255, 0, 0, 0.1);
	}

	.link-preview-card.instagram .platform-logo {
		background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
		background-size: 200% 200%;
		animation: instagram-gradient 3s ease infinite;
	}

	.link-preview-card.spotify .platform-logo {
		background: rgba(29, 185, 84, 0.1);
	}

	.link-preview-card.twitter .platform-logo {
		background: rgba(29, 161, 242, 0.1);
	}

	.link-preview-card.github .platform-logo {
		background: rgba(36, 41, 47, 0.1);
	}

	.link-preview-card.amazon .platform-logo {
		background: rgba(255, 153, 0, 0.1);
	}

	.link-preview-card.lhamacorp .platform-logo {
		background: rgba(0, 102, 204, 0.1);
	}

	@keyframes instagram-gradient {
		0% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}

	/* Dark theme adjustments */
	:global([data-theme='dark']) .link-preview-card {
		background: var(--bg-glass);
		border-color: var(--glass-border);
	}

	:global([data-theme='dark']) .link-preview-card:hover {
		background: var(--bg-glass-hover);
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
	}

	:global([data-theme='dark']) .platform-logo {
		background: var(--bg-glass-hover);
	}

	:global([data-theme='dark']) .link-preview-card.youtube .platform-logo {
		background: rgba(255, 0, 0, 0.15);
	}

	:global([data-theme='dark']) .link-preview-card.spotify .platform-logo {
		background: rgba(29, 185, 84, 0.15);
	}

	:global([data-theme='dark']) .link-preview-card.twitter .platform-logo {
		background: rgba(29, 161, 242, 0.15);
	}

	:global([data-theme='dark']) .link-preview-card.github .platform-logo {
		background: rgba(240, 246, 252, 0.1);
	}

	:global([data-theme='dark']) .link-preview-card.amazon .platform-logo {
		background: rgba(255, 153, 0, 0.15);
	}

	:global([data-theme='dark']) .link-preview-card.lhamacorp .platform-logo {
		background: rgba(0, 102, 204, 0.15);
	}
</style>
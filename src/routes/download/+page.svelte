<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	const repo = 'LhamacorpLabs/chat-client';
	const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
	const releasesUrl = `https://github.com/${repo}/releases/latest`;

	interface Platform {
		name: string;
		icon: string;
		desc: string;
		match: (filename: string) => boolean;
		url: string;
	}

	let platforms = $state<Platform[]>([
		{
			name: 'macOS (Apple Silicon)',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
			desc: 'M1/M2/M3/M4 Macs',
			match: (f) => f.endsWith('arm64.dmg'),
			url: ''
		},
		{
			name: 'macOS (Intel)',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
			desc: 'Intel-based Macs',
			match: (f) => f.endsWith('x64.dmg'),
			url: ''
		},
		{
			name: 'Windows',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 12V6.5l8-1.1V12H3zm0 .5h8v6.6l-8-1.1V12.5zm9 0h9V2.5l-9 1.2V12.5zm0 .5v6.3l9 1.2V13H12z"/></svg>`,
			desc: 'Windows 10/11',
			match: (f) => f.endsWith('x64-setup.exe'),
			url: ''
		},
		{
			name: 'Linux (AppImage)',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 2.1c-.7 0-1.3.5-1.6 1.2-.5 1.1-.4 2.5-.1 3.7-1.3.8-2.2 2-2.7 3.4-.4 1.1-.5 2.3-.3 3.4-1 .7-1.7 1.5-2 2.4-.4 1.1-.1 2.2.7 3 .6.6 1.4.9 2.3.9.5 0 1-.1 1.5-.3.7.5 1.6.8 2.6.8s1.9-.3 2.6-.8c.5.2 1 .3 1.5.3.9 0 1.7-.3 2.3-.9.8-.8 1.1-1.9.7-3-.3-.9-1-1.7-2-2.4.2-1.1.1-2.3-.3-3.4-.5-1.4-1.4-2.6-2.7-3.4.3-1.2.4-2.6-.1-3.7-.3-.7-.9-1.2-1.6-1.2-.4 0-.8.2-1.1.5-.3-.3-.7-.5-1.1-.5z"/></svg>`,
			desc: 'Universal Linux',
			match: (f) => f.endsWith('.AppImage'),
			url: ''
		},
		{
			name: 'Linux (deb)',
			icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 2.1c-.7 0-1.3.5-1.6 1.2-.5 1.1-.4 2.5-.1 3.7-1.3.8-2.2 2-2.7 3.4-.4 1.1-.5 2.3-.3 3.4-1 .7-1.7 1.5-2 2.4-.4 1.1-.1 2.2.7 3 .6.6 1.4.9 2.3.9.5 0 1-.1 1.5-.3.7.5 1.6.8 2.6.8s1.9-.3 2.6-.8c.5.2 1 .3 1.5.3.9 0 1.7-.3 2.3-.9.8-.8 1.1-1.9.7-3-.3-.9-1-1.7-2-2.4.2-1.1.1-2.3-.3-3.4-.5-1.4-1.4-2.6-2.7-3.4.3-1.2.4-2.6-.1-3.7-.3-.7-.9-1.2-1.6-1.2-.4 0-.8.2-1.1.5-.3-.3-.7-.5-1.1-.5z"/></svg>`,
			desc: 'Ubuntu/Debian',
			match: (f) => f.endsWith('x64.deb'),
			url: ''
		}
	]);

	let loading = $state(true);
	let error = $state(false);

	onMount(async () => {
		try {
			const res = await fetch(apiUrl);
			if (!res.ok) throw new Error();
			const data = await res.json();
			const assets: { name: string; browser_download_url: string }[] = data.assets;

			platforms = platforms.map(p => {
				const asset = assets.find(a => p.match(a.name));
				return { ...p, url: asset?.browser_download_url || '' };
			});
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	});
</script>

<div class="download-page">
	<div class="download-container">
		<img class="app-icon" src="/logo.png" alt="" />
		<h1>Download Chat</h1>
		<p class="subtitle">Native desktop client with auto-updates</p>

		{#if loading}
			<p class="loading">Loading releases...</p>
		{:else if error}
			<p class="error-text">Could not load releases.</p>
			<a href={releasesUrl} target="_blank" rel="noopener" class="download-button">
				View on GitHub
			</a>
		{:else}
			<div class="platforms">
				{#each platforms as platform (platform.name)}
					{#if platform.url}
						<a href={platform.url} rel="external" class="platform-card" download>
							<span class="platform-icon">
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- platform.icon is fixed, developer-authored SVG markup from the platforms literal above, never user input -->
								{@html platform.icon}
							</span>
							<div class="platform-info">
								<span class="platform-name">{platform.name}</span>
								<span class="platform-desc">{platform.desc}</span>
							</div>
							<span class="download-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
									<path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
								</svg>
							</span>
						</a>
					{/if}
				{/each}
			</div>
		{/if}

		<details class="macos-note">
			<summary>macOS: "App is damaged" fix</summary>
			<p>If macOS says the app is damaged or can't be opened, run this in Terminal:</p>
			<code>xattr -r -d com.apple.quarantine /Applications/Chat.app</code>
		</details>

		<a href={resolve('/')} class="back-link">← Back to Chat</a>
	</div>
</div>

<style>
	/* body is position: fixed / overflow: hidden (app shell), so this page
	   provides its own scroll container. */
	.download-page {
		height: 100vh;
		height: 100dvh;
		overflow-y: auto;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 5rem 1.5rem 3rem;
		background:
			radial-gradient(60% 40% at 50% 0%, var(--accent-subtle), transparent 70%),
			var(--app-bg);
	}

	.download-container {
		max-width: 460px;
		width: 100%;
		text-align: center;
		animation: fadeIn 0.4s var(--ease-out-expo);
	}

	.app-icon {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		box-shadow: var(--shadow-lg);
		margin-bottom: 1.5rem;
	}

	h1 {
		color: var(--text-primary);
		margin: 0 0 0.5rem;
		font-size: 1.75rem;
		font-weight: 650;
	}

	.subtitle {
		color: var(--text-secondary);
		margin: 0 0 2.25rem;
		font-size: 0.9375rem;
	}

	.loading, .error-text {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.platforms {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--panel-bg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.platform-card {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.platform-card + .platform-card {
		border-top: 1px solid var(--border);
	}

	.platform-card:hover {
		background: var(--surface-hover);
	}

	.platform-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--surface-hover);
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.platform-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex: 1;
		line-height: 1.35;
	}

	.platform-name {
		color: var(--text-primary);
		font-weight: 550;
		font-size: 0.9063rem;
	}

	.platform-desc {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.download-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.platform-card:hover .download-icon {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.download-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 1.25rem;
		height: 2.5rem;
		padding: 0 1.25rem;
		background: var(--accent);
		color: var(--accent-contrast);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.875rem;
		transition: background-color 0.15s ease, box-shadow 0.15s ease;
	}

	.download-button:hover {
		background: var(--accent-hover);
		box-shadow: 0 4px 12px var(--accent-shadow);
	}

	.macos-note {
		margin-top: 1.75rem;
		text-align: left;
		font-size: 0.8125rem;
		color: var(--text-muted);
	}

	.macos-note summary {
		cursor: pointer;
		text-align: center;
	}

	.macos-note summary:hover {
		color: var(--text-secondary);
	}

	.macos-note p {
		margin: 0.75rem 0 0.5rem;
	}

	.macos-note code {
		display: block;
		font-family: var(--font-mono);
		background: var(--surface-hover);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 0.625rem 0.75rem;
		font-size: 0.75rem;
		color: var(--text-primary);
		word-break: break-all;
	}

	.back-link {
		display: inline-block;
		margin-top: 2rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.back-link:hover {
		color: var(--text-primary);
	}
</style>

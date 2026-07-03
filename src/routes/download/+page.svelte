<script lang="ts">
	import { onMount } from 'svelte';

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
			match: (f) => f.endsWith('aarch64.dmg'),
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
			match: (f) => f.endsWith('amd64.deb'),
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
				{#each platforms as platform}
					{#if platform.url}
						<a href={platform.url} class="platform-card" download>
							<span class="platform-icon">{@html platform.icon}</span>
							<div class="platform-info">
								<span class="platform-name">{platform.name}</span>
								<span class="platform-desc">{platform.desc}</span>
							</div>
							<span class="download-icon">↓</span>
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

		<a href="/" class="back-link">← Back to Chat</a>
	</div>
</div>

<style>
	.download-page {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background: var(--bg-primary);
		padding: 4rem 2rem 2rem;
	}

	.download-container {
		max-width: 480px;
		width: 100%;
		text-align: center;
	}

	h1 {
		color: var(--text-primary);
		margin: 0 0 0.5rem;
		font-size: 1.8rem;
	}

	.subtitle {
		color: var(--text-muted);
		margin: 0 0 2rem;
		font-size: 0.9rem;
	}

	.loading, .error-text {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.platforms {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.platform-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		text-decoration: none;
		transition: border-color 0.15s, background 0.15s;
	}

	.platform-card:hover {
		border-color: var(--accent);
		background: var(--bg-tertiary);
	}

	.platform-icon {
		flex-shrink: 0;
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.platform-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex: 1;
	}

	.platform-name {
		color: var(--text-primary);
		font-weight: 500;
		font-size: 0.95rem;
	}

	.platform-desc {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.download-icon {
		color: var(--text-muted);
		font-size: 1.2rem;
		font-weight: bold;
	}

	.download-button {
		display: inline-block;
		margin-top: 1.5rem;
		padding: 0.85rem 2rem;
		background: var(--accent);
		color: #fff;
		border-radius: 0.6rem;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.95rem;
		transition: opacity 0.15s;
	}

	.download-button:hover {
		opacity: 0.85;
	}

	.macos-note {
		margin-top: 2rem;
		text-align: left;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.macos-note summary {
		cursor: pointer;
		text-align: center;
	}

	.macos-note p {
		margin: 0.5rem 0;
	}

	.macos-note code {
		display: block;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.4rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
		word-break: break-all;
	}

	.back-link {
		display: inline-block;
		margin-top: 2rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back-link:hover {
		color: var(--text-primary);
	}
</style>

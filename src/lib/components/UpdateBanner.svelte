<script lang="ts">
	import { updateReady, restartApp } from '$lib/utils/updater';

	let dismissed = $state(false);
</script>

{#if $updateReady && !dismissed}
	<div class="update-banner">
		<span>New version ready</span>
		<button onclick={() => restartApp()}>Restart</button>
		<button class="close" onclick={() => (dismissed = true)}>✕</button>
	</div>
{/if}

<style>
	.update-banner {
		position: fixed;
		bottom: 80px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: var(--panel-bg);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
	}

	button {
		padding: 4px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-contrast);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: var(--accent-hover);
	}

	.close {
		padding: 2px 6px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 1rem;
		line-height: 1;
		opacity: 0.7;
	}

	.close:hover {
		opacity: 1;
		background: transparent;
		color: var(--text-primary);
	}
</style>

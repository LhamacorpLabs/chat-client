<script lang="ts">
	import { updateReady, restartApp } from '$lib/utils/updater';

	let dismissed = $state(false);
</script>

{#if $updateReady && !dismissed}
	<div class="update-banner" role="status">
		<span class="update-icon" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
				<path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" />
			</svg>
		</span>
		<span class="update-text">
			<strong>Update ready</strong>
			<span>Restart to get the latest version.</span>
		</span>
		<button class="restart" onclick={() => restartApp()}>Restart</button>
		<button class="close" onclick={() => (dismissed = true)} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14" aria-hidden="true">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.update-banner {
		position: fixed;
		bottom: 96px;
		right: 20px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 8px 10px 12px;
		background: var(--panel-bg);
		color: var(--text-primary);
		font-size: 0.8125rem;
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		animation: popIn 0.3s var(--ease-out-expo, ease-out);
	}

	.update-icon {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		color: var(--accent);
		background: var(--accent-subtle);
	}

	.update-text {
		display: flex;
		flex-direction: column;
		line-height: 1.35;
	}

	.update-text strong {
		font-weight: 600;
	}

	.update-text span {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.restart {
		height: 30px;
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-contrast);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.restart:hover {
		background: var(--accent-hover);
	}

	.close {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.close:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}
</style>

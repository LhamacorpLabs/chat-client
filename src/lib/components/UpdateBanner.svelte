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
		background: var(--accent, #4f46e5);
		color: white;
		font-size: 0.85rem;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		z-index: 1000;
	}

	button {
		padding: 4px 12px;
		border: 1px solid rgba(255, 255, 255, 0.6);
		border-radius: 4px;
		background: transparent;
		color: white;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.close {
		padding: 2px 6px;
		border: none;
		font-size: 1rem;
		line-height: 1;
		opacity: 0.7;
	}

	.close:hover {
		opacity: 1;
		background: transparent;
	}
</style>

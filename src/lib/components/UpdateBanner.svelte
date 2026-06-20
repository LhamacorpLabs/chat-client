<script lang="ts">
	import { updateReady, restartApp } from '$lib/utils/updater';
</script>

{#if $updateReady}
	<div class="update-banner">
		<span>New version ready</span>
		<button onclick={() => restartApp()}>Restart</button>
	</div>
{/if}

<style>
	.update-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--accent, #4f46e5);
		color: white;
		font-size: 0.85rem;
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
</style>

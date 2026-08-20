<script lang="ts">
	import { emojis } from '$lib/utils/emojis';

	interface Props {
		onSelect: (code: string) => void;
		onClose: () => void;
	}

	let { onSelect, onClose }: Props = $props();
</script>

<div class="emoji-picker">
	<div class="emoji-grid">
		{#each emojis as entry}
			<button
				type="button"
				class="emoji-item"
				title={entry.code}
				onclick={() => onSelect(entry.code)}
			>
				{entry.emoji}
			</button>
		{/each}
	</div>
</div>

<style>
	.emoji-picker {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0.75rem;
		z-index: 100;
		width: 280px;
	}

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.emoji-item {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		font-size: 1.25rem;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.emoji-item:hover {
		background: var(--surface-hover);
	}
</style>

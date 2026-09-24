<script lang="ts">
	import { emojis } from '$lib/utils/emojis';

	interface Props {
		onSelect: (code: string) => void;
	}

	let { onSelect }: Props = $props();
</script>

<div class="emoji-picker">
	<div class="emoji-grid">
		{#each emojis as entry (entry.code)}
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
		bottom: calc(100% + 14px);
		right: -2.5rem;
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
		z-index: 100;
		width: 272px;
		animation: popIn 0.18s var(--ease-out-expo, ease-out);
		transform-origin: bottom right;
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
		transition: background-color 0.1s ease, transform 0.1s ease;
	}

	.emoji-item:hover {
		background: var(--surface-hover);
		transform: scale(1.15);
	}
</style>

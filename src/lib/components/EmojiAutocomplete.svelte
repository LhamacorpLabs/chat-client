<script lang="ts">
	import { searchEmojis } from '$lib/utils/emojis';

	interface Props {
		query: string;
		onSelect: (code: string) => void;
		selectedIndex: number;
	}

	let { query, onSelect, selectedIndex }: Props = $props();

	let results = $derived(searchEmojis(query));
</script>

{#if results.length > 0}
	<div class="emoji-autocomplete">
		{#each results as entry, i (entry.code)}
			<button
				type="button"
				class="autocomplete-item"
				class:selected={i === selectedIndex}
				onclick={() => onSelect(entry.code)}
			>
				<span class="autocomplete-emoji">{entry.emoji}</span>
				<span class="autocomplete-code">{entry.code}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.emoji-autocomplete {
		position: absolute;
		bottom: calc(100% + 14px);
		left: 0;
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.3125rem;
		animation: popIn 0.16s var(--ease-out-expo, ease-out);
		z-index: 101;
		min-width: 180px;
		max-height: 200px;
		overflow-y: auto;
	}

	.autocomplete-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.625rem;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--text-primary);
		transition: background 0.1s ease;
	}

	.autocomplete-item:hover {
		background: var(--surface-hover);
	}

	.autocomplete-item.selected {
		background: var(--accent-subtle);
	}

	.autocomplete-emoji {
		font-size: 1.125rem;
	}

	.autocomplete-code {
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>

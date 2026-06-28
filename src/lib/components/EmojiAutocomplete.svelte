<script lang="ts">
	import { searchEmojis, type EmojiEntry } from '$lib/utils/emojis';

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
		{#each results as entry, i}
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
		bottom: calc(100% + 4px);
		left: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px var(--shadow-elevated);
		padding: 0.25rem;
		z-index: 101;
		min-width: 180px;
		max-height: 200px;
		overflow-y: auto;
	}

	:global([data-theme='dark']) .emoji-autocomplete {
		background: var(--bg-secondary);
		border-color: var(--glass-border);
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

	.autocomplete-item:hover,
	.autocomplete-item.selected {
		background: var(--bg-secondary);
	}

	:global([data-theme='dark']) .autocomplete-item:hover,
	:global([data-theme='dark']) .autocomplete-item.selected {
		background: var(--bg-glass-hover);
	}

	.autocomplete-emoji {
		font-size: 1.125rem;
	}

	.autocomplete-code {
		color: var(--text-muted);
	}
</style>

<script lang="ts">
	import { emojis } from '$lib/utils/emojis';
	import { emotes } from '$lib/utils/emotes';

	interface Props {
		onSelect: (code: string) => void;
	}

	let { onSelect }: Props = $props();

	let tab = $state<'emoji' | 'emotes'>('emoji');
</script>

<div class="emoji-picker">
	<div class="picker-tabs" role="tablist">
		<button
			type="button"
			role="tab"
			class="picker-tab"
			class:active={tab === 'emoji'}
			aria-selected={tab === 'emoji'}
			onclick={() => (tab = 'emoji')}
		>
			Emoji
		</button>
		{#if emotes.length > 0}
			<button
				type="button"
				role="tab"
				class="picker-tab"
				class:active={tab === 'emotes'}
				aria-selected={tab === 'emotes'}
				onclick={() => (tab = 'emotes')}
			>
				Emotes
			</button>
		{/if}
	</div>
	<div class="picker-body">
		<div class="emoji-grid">
			{#if tab === 'emoji'}
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
			{:else}
				{#each emotes as entry (entry.code)}
					<button
						type="button"
						class="emoji-item"
						title={entry.code}
						onclick={() => onSelect(entry.code)}
					>
						<img class="emote-img" src={entry.src} alt={entry.code} loading="lazy" />
					</button>
				{/each}
			{/if}
		</div>
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

	.picker-tabs {
		display: flex;
		gap: 2px;
		margin-bottom: 0.375rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--border-hover);
	}

	.picker-tab {
		flex: 1;
		padding: 0.25rem 0.5rem;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.1s ease, color 0.1s ease;
	}

	.picker-tab:hover {
		background: var(--surface-hover);
	}

	.picker-tab.active {
		background: var(--accent-subtle);
		color: var(--text-primary);
	}

	.picker-body {
		height: 176px;
		overflow-y: auto;
	}

	.emote-img {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}

	.emoji-item:hover {
		background: var(--surface-hover);
		transform: scale(1.15);
	}
</style>

<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { HelpEntry } from '$lib/commands';

	interface Props {
		entries: HelpEntry[];
		onClose: () => void;
	}

	let { entries, onClose }: Props = $props();

	// "/mute [on|off]" -> the command itself, and its argument hint shown muted.
	function split(usage: string): { name: string; args: string } {
		const [name, ...rest] = usage.split(' ');
		return { name, args: rest.join(' ') };
	}
</script>

<Modal title="Commands" description="Type these in the message box." {onClose} maxWidth="480px">
	<ul class="command-list">
		{#each entries as entry (entry.usage)}
			{@const { name, args } = split(entry.usage)}
			<li class="command-row">
				<code class="command-usage">
					<span class="command-name">{name}</span>{#if args}<span class="command-args">{args}</span>{/if}
				</code>
				<span class="command-description">{entry.description}</span>
			</li>
		{/each}
	</ul>
</Modal>

<style>
	.command-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.command-row {
		display: grid;
		grid-template-columns: minmax(8.5rem, max-content) 1fr;
		align-items: baseline;
		column-gap: var(--space-4);
		padding: 0.625rem 0;
		border-top: 1px solid var(--border, var(--border-hover));
	}

	.command-row:first-child {
		border-top: none;
		padding-top: 0;
	}

	.command-row:last-child {
		padding-bottom: 0;
	}

	.command-usage {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.command-name {
		color: var(--accent);
		font-weight: 600;
	}

	.command-args {
		margin-left: 0.5ch;
		color: var(--text-muted);
	}

	.command-description {
		color: var(--text-secondary, var(--text-primary));
		font-size: 0.875rem;
		line-height: 1.45;
	}

	@media (max-width: 480px) {
		.command-row {
			grid-template-columns: 1fr;
			row-gap: 0.125rem;
		}
	}
</style>

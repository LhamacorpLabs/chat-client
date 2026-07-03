<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		children?: Snippet;
	}

	let { icon = '📭', title, description, children }: Props = $props();
</script>

<div class="empty-state">
	<div class="empty-icon">{icon}</div>
	<h3>{title}</h3>
	{#if description}
		<p>{description}</p>
	{/if}
	{#if children}
		<div class="empty-actions">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.empty-state {
		text-align: center;
		padding: var(--space-12) var(--space-8);
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: var(--space-4);
		opacity: 0.6;
	}

	.empty-state h3 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text-primary);
		font-size: var(--font-xl);
		font-weight: 600;
	}

	.empty-state p {
		margin: 0;
		font-size: var(--font-base);
		color: var(--text-muted);
	}

	.empty-actions {
		margin-top: var(--space-4);
	}

	@media (max-width: 480px) {
		.empty-state {
			padding: var(--space-8) var(--space-4);
		}
	}
</style>

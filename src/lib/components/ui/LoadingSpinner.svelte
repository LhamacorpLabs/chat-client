<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		label?: string;
		inline?: boolean;
	}

	let { size = 'md', label, inline = false }: Props = $props();
</script>

<div class="spinner-container" class:inline>
	<div class="spinner spinner-{size}"></div>
	{#if label}
		<p class="spinner-label">{label}</p>
	{/if}
</div>

<style>
	.spinner-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
	}

	.spinner-container.inline {
		flex-direction: row;
		gap: var(--space-2);
	}

	.spinner {
		border: 2px solid var(--border-color);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: spin 0.8s linear infinite;
	}

	.spinner-sm {
		width: 16px;
		height: 16px;
	}

	.spinner-md {
		width: 24px;
		height: 24px;
	}

	.spinner-lg {
		width: 32px;
		height: 32px;
	}

	.spinner-label {
		color: var(--text-muted);
		font-size: var(--font-base);
		margin: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

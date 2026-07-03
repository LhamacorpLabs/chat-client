<script lang="ts">
	interface Props {
		message: string;
		onDismiss: () => void;
		variant?: 'error' | 'success' | 'warning';
	}

	let { message, onDismiss, variant = 'error' }: Props = $props();
</script>

<div class="error-toast alert alert-{variant}">
	{message}
	<button onclick={onDismiss} class="close-btn" type="button" aria-label="Dismiss">&times;</button>
</div>

<style>
	.error-toast {
		position: fixed;
		top: var(--space-6);
		right: var(--space-6);
		z-index: 1200;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 280px;
		max-width: 90vw;
		box-shadow: 0 4px 16px var(--shadow-elevated);
	}

	.close-btn {
		background: none;
		border: none;
		font-size: var(--font-lg);
		color: inherit;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.close-btn:hover {
		opacity: 1;
	}
</style>

<script lang="ts">
	interface Props {
		message: string;
		onDismiss: () => void;
		variant?: 'error' | 'success' | 'warning';
	}

	let { message, onDismiss, variant = 'error' }: Props = $props();
</script>

<div class="toast {variant}" role={variant === 'error' ? 'alert' : 'status'}>
	<span class="toast-icon" aria-hidden="true">
		{#if variant === 'success'}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="16"
				height="16"
			>
				<circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" />
			</svg>
		{:else}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="16"
				height="16"
			>
				<circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
			</svg>
		{/if}
	</span>
	<span class="toast-message">{message}</span>
	<button onclick={onDismiss} class="close-btn" type="button" aria-label="Dismiss">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			width="14"
			height="14"
			aria-hidden="true"
		>
			<path d="M18 6L6 18M6 6l12 12" />
		</svg>
	</button>
</div>

<style>
	.toast {
		position: fixed;
		top: calc(var(--space-4) + env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		z-index: 1200;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 280px;
		max-width: min(480px, calc(100vw - 2rem));
		padding: 0.625rem 0.5rem 0.625rem 0.875rem;
		border-radius: var(--radius-md);
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		box-shadow: var(--shadow-lg);
		color: var(--text-primary);
		font-size: 0.875rem;
		animation: toastIn 0.3s var(--ease-out-expo, ease-out);
	}

	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translate(-50%, -10px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	.toast-icon {
		display: flex;
		flex-shrink: 0;
	}

	.toast.error .toast-icon {
		color: var(--error-text);
	}

	.toast.success .toast-icon {
		color: var(--success-text);
	}

	.toast.warning .toast-icon {
		color: var(--warning-text);
	}

	.toast-message {
		flex: 1;
		min-width: 0;
		line-height: 1.4;
	}

	.close-btn {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.close-btn:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}
</style>

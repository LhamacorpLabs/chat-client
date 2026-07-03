<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		align?: 'left' | 'right';
		width?: string;
		trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
		children: Snippet<[{ close: () => void }]>;
	}

	let { align = 'right', width = '180px', trigger, children }: Props = $props();

	let open = $state(false);
	let rootEl: HTMLDivElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;

		function handleClickOutside(event: MouseEvent) {
			if (rootEl && !rootEl.contains(event.target as Node)) {
				close();
			}
		}

		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				close();
			}
		}

		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="dropdown-root" bind:this={rootEl}>
	{@render trigger({ toggle, open })}
	{#if open}
		<div class="dropdown-menu" class:align-left={align === 'left'} style="min-width: {width}">
			{@render children({ close })}
		</div>
	{/if}
</div>

<style>
	.dropdown-root {
		position: relative;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 16px var(--shadow-elevated);
		z-index: 1000;
		padding: var(--space-1);
	}

	.dropdown-menu.align-left {
		right: auto;
		left: 0;
	}

	:global([data-theme='dark']) .dropdown-menu {
		background: var(--bg-secondary);
		border-color: var(--glass-border);
		backdrop-filter: blur(var(--glass-blur));
		-webkit-backdrop-filter: blur(var(--glass-blur));
	}

	:global(.dropdown-menu .dropdown-item) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: none;
		border: none;
		text-align: left;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-standard);
		font-size: var(--font-sm);
		border-radius: var(--radius-sm);
	}

	:global(.dropdown-menu .dropdown-item:hover) {
		background: var(--bg-secondary);
	}

	:global([data-theme='dark'] .dropdown-menu .dropdown-item:hover) {
		background: var(--bg-glass-hover);
	}

	:global(.dropdown-menu .dropdown-item.danger) {
		color: var(--danger);
	}

	:global(.dropdown-menu .dropdown-item.danger:hover) {
		background: var(--danger-subtle);
	}
</style>

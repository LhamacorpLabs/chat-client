<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		align?: 'left' | 'right';
		/** 'bottom' drops the menu below the trigger (default); 'right' pops
		 *  it out to the trigger's side, bottom-anchored - for triggers that
		 *  sit at the bottom edge of the viewport, like a rail avatar. */
		placement?: 'bottom' | 'right';
		width?: string;
		trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
		children: Snippet<[{ close: () => void }]>;
	}

	let { align = 'right', placement = 'bottom', width = '180px', trigger, children }: Props = $props();

	let open = $state(false);
	let rootEl: HTMLDivElement | undefined = $state();
	// 'right' placement is positioned in JS (fixed to the viewport) rather
	// than via ancestor-relative CSS: a rail avatar sits inside a
	// `.rail` that clips overflow for its width-collapse transition, so a
	// CSS-absolute popover popping out sideways would be clipped by it.
	let fixedPos = $state('');

	function toggle() {
		open = !open;
		if (open && placement === 'right') positionFixedMenu();
	}

	function positionFixedMenu() {
		if (!rootEl) return;
		const rect = rootEl.getBoundingClientRect();
		fixedPos = `position: fixed; top: auto; right: auto; left: ${rect.right + 8}px; bottom: ${window.innerHeight - rect.bottom}px;`;
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
		<div
			class="dropdown-menu"
			class:align-left={align === 'left'}
			class:placement-right={placement === 'right'}
			style="min-width: {width}; {placement === 'right' ? fixedPos : ''}"
		>
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
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		z-index: 1000;
		padding: var(--space-1);
	}

	.dropdown-menu.align-left {
		right: auto;
		left: 0;
	}

	.dropdown-menu.placement-right {
		top: auto;
		bottom: 0;
		left: calc(100% + 8px);
		right: auto;
	}

	:global(.dropdown-menu .dropdown-header) {
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.dropdown-menu .dropdown-separator) {
		height: 1px;
		margin: var(--space-1) 0;
		background: var(--border);
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
		background: var(--surface-hover);
	}

	:global(.dropdown-menu .dropdown-item.danger) {
		color: var(--danger);
	}

	:global(.dropdown-menu .dropdown-item.danger:hover) {
		background: var(--error-bg);
	}
</style>

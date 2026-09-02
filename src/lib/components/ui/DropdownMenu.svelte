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
	let menuEl: HTMLDivElement | undefined = $state();
	// Always positioned in JS (fixed to the viewport) and portaled to
	// <body> (see `portal` below) rather than left as an absolute-
	// positioned DOM descendant: a trigger can sit inside an ancestor
	// that establishes its own containing block for fixed-position
	// descendants too - not just `overflow: hidden` (a `.rail` clipped
	// for its width-collapse transition), but `backdrop-filter` (the
	// chat header's glass panel) and `transform`/`filter`/`will-change`
	// all do this per spec. Inside such an ancestor, `position: fixed`
	// does NOT escape to the viewport, so a popover popping out past the
	// ancestor's own box gets covered by whatever paints after it in the
	// DOM - a high z-index doesn't help, since it only ranks the popover
	// within the trapping ancestor's stacking context, not the page's.
	// Moving the node itself to <body> sidesteps the trap entirely.
	let fixedPos = $state('');

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function toggle() {
		open = !open;
		if (open) positionFixedMenu();
	}

	function positionFixedMenu() {
		if (!rootEl) return;
		const rect = rootEl.getBoundingClientRect();
		if (placement === 'right') {
			fixedPos = `position: fixed; top: auto; right: auto; left: ${rect.right + 8}px; bottom: ${window.innerHeight - rect.bottom}px;`;
		} else if (align === 'left') {
			fixedPos = `position: fixed; bottom: auto; right: auto; top: ${rect.bottom + 4}px; left: ${rect.left}px;`;
		} else {
			fixedPos = `position: fixed; bottom: auto; left: auto; top: ${rect.bottom + 4}px; right: ${window.innerWidth - rect.right}px;`;
		}
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;

		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			// The menu itself is portaled to <body> (see `portal`), so it's
			// no longer a DOM descendant of rootEl - check both.
			if (rootEl?.contains(target)) return;
			if (menuEl?.contains(target)) return;
			close();
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
			style="min-width: {width}; {fixedPos}"
			bind:this={menuEl}
			use:portal
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

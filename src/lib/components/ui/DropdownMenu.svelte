<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		align?: 'left' | 'right';
		/** 'bottom' drops the menu below the trigger (default); 'right' pops
		 *  it out to the trigger's side, bottom-anchored - for triggers that
		 *  sit at the bottom edge of the viewport, like a rail avatar; 'top'
		 *  opens it above the trigger (e.g. an account button in a footer). */
		placement?: 'bottom' | 'right' | 'top';
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
		} else if (placement === 'top') {
			fixedPos = `position: fixed; top: auto; right: auto; left: ${rect.left}px; bottom: ${window.innerHeight - rect.top + 6}px; width: ${Math.max(rect.width, 0)}px;`;
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
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		padding: 0.3125rem;
		animation: dropdownIn 0.14s var(--ease-out-expo, ease-out);
		transform-origin: top right;
	}

	@keyframes dropdownIn {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(-2px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
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
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
		font-size: var(--font-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.dropdown-menu .dropdown-separator) {
		height: 1px;
		margin: 0.3125rem -0.3125rem;
		background: var(--border);
	}

	:global(.dropdown-menu .dropdown-item) {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		height: 2.125rem;
		padding: 0 0.625rem;
		background: none;
		border: none;
		text-align: left;
		text-decoration: none;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--ease-standard);
		font-family: inherit;
		font-size: var(--font-sm);
		font-weight: 450;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	:global(.dropdown-menu .dropdown-item svg) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	:global(.dropdown-menu .dropdown-item span) {
		flex: 1;
	}

	:global(.dropdown-menu .dropdown-item kbd) {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-muted);
		padding: 0.0625rem 0.3125rem;
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	:global(.dropdown-menu .dropdown-item:hover:not(:disabled)) {
		background: var(--surface-hover);
	}

	:global(.dropdown-menu .dropdown-item:hover:not(:disabled) svg) {
		color: var(--text-primary);
	}

	:global(.dropdown-menu .dropdown-item:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.dropdown-menu .dropdown-item.danger),
	:global(.dropdown-menu .dropdown-item.danger svg) {
		color: var(--danger);
	}

	:global(.dropdown-menu .dropdown-item.danger:hover:not(:disabled)) {
		background: var(--error-bg);
	}

	:global(.dropdown-menu .dropdown-item.danger:hover:not(:disabled) svg) {
		color: var(--danger);
	}

	:global(.dropdown-menu .dropdown-footer) {
		padding: 0.375rem 0.625rem 0.25rem;
		font-size: 0.6875rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
</style>

<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import type { Chat } from '$lib/types/chat';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { colorForChat } from '$lib/utils/chatAvatar';

	interface Props {
		chats: Chat[];
		activeChatId?: string;
		unreadMap?: Record<string, boolean>;
		isLoading: boolean;
		error: string | null;
		selectedChatIndex: number;
		expanded: boolean;
		onToggleExpanded: () => void;
		onSelectChat: (id: string) => void;
		onOpenCreateModal: () => void;
		onOpenJoinModal: () => void;
		onLogout: () => void;
	}

	let {
		chats,
		activeChatId,
		unreadMap = {},
		isLoading,
		error,
		selectedChatIndex,
		expanded,
		onToggleExpanded,
		onSelectChat,
		onOpenCreateModal,
		onOpenJoinModal,
		onLogout
	}: Props = $props();

	const initial = $derived(($authStore.user?.username ?? '?').charAt(0).toUpperCase());
</script>

<nav class="rail" class:expanded aria-label="Primary">
	<div class="rail-top">
		<div class="rail-mark">
			<img src="/logo.png" alt="" />
		</div>

		{#if expanded}
			<span class="rail-brand-name">Chat</span>
			<DropdownMenu width="120px">
				{#snippet trigger({ toggle })}
					<button onclick={toggle} class="icon-btn add-btn" title="Create or join a chat" type="button">+</button>
				{/snippet}
				{#snippet children({ close })}
					<button onclick={() => { onOpenCreateModal(); close(); }} class="dropdown-item" type="button">
						<span>Create</span>
					</button>
					<button onclick={() => { onOpenJoinModal(); close(); }} class="dropdown-item" type="button">
						<span>Join</span>
					</button>
				{/snippet}
			</DropdownMenu>
		{/if}

		<button
			class="rail-btn toggle-btn"
			class:active={expanded}
			type="button"
			onclick={onToggleExpanded}
			title={expanded ? 'Collapse' : 'Show chat list'}
			aria-expanded={expanded}
		>
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				{#if expanded}
					<path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				{:else}
					<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
				{/if}
			</svg>
		</button>
	</div>

	<div class="chat-region">
		{#if error}
			<div class="alert alert-error">{error}</div>
		{/if}

		{#if isLoading}
			<div class="loading-container">
				<LoadingSpinner label="Loading your chats..." />
			</div>
		{/if}

		{#if !isLoading && chats.length > 0}
			{#if expanded}
				<div class="chats-list">
					{#each chats as chat, index (chat.id)}
						<button
							class="chat-item"
							class:selected={index === selectedChatIndex}
							class:open={chat.id === activeChatId}
							onclick={() => onSelectChat(chat.id)}
							type="button"
						>
							<div class="chat-info">
								<div class="chat-name-container">
									<h3 class="chat-name">#{chat.name}</h3>
									{#if unreadMap[chat.id]}
										<div class="unread-indicator" title="New messages"></div>
									{/if}
								</div>
								<p class="chat-meta">
									Created {new Date(chat.createdAt).toLocaleDateString()}
									{#if chat.members.length > 0}
										• {chat.members.length} member{chat.members.length === 1 ? '' : 's'}
									{/if}
								</p>
							</div>
							<div class="chat-chevron">→</div>
						</button>
					{/each}
				</div>
			{:else}
				<div class="chat-stack">
					{#each chats as chat (chat.id)}
						<button
							class="chat-avatar"
							class:active={chat.id === activeChatId}
							type="button"
							onclick={() => onSelectChat(chat.id)}
							title={`#${chat.name}`}
							style={`background: ${colorForChat(chat.id)}`}
						>
							{chat.name.charAt(0).toUpperCase()}
							{#if unreadMap[chat.id]}
								<span class="unread-dot" aria-label="Unread messages"></span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}

		{#if !isLoading && chats.length === 0 && !error && expanded}
			<EmptyState
				icon="💬"
				title="No chats yet"
				description={'Create your first chat or join one with an invitation code using the "+" button above!'}
			/>
		{/if}
	</div>

	{#if expanded}
		<div class="rail-footer">
			<button class="nav-item" onclick={onLogout} type="button">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
					<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
					<path d="M16 17l5-5-5-5" />
					<path d="M21 12H9" />
				</svg>
				<span>Sign Out</span>
			</button>
			<div class="rail-user">
				<div class="user-avatar">{initial}</div>
				<div class="user-meta">
					<div class="user-name">@{$authStore.user?.username}</div>
				</div>
				<ThemeToggle />
			</div>
		</div>
	{:else}
		<div class="rail-bottom">
			<ThemeToggle />
			<DropdownMenu placement="right" width="180px">
				{#snippet trigger({ toggle })}
					<button
						class="rail-avatar"
						type="button"
						onclick={toggle}
						title={$authStore.user?.username ?? ''}
						aria-label="Account menu"
					>
						{initial}
					</button>
				{/snippet}
				{#snippet children({ close })}
					<div class="dropdown-header">@{$authStore.user?.username}</div>
					<div class="dropdown-separator"></div>
					<button
						onclick={() => { onLogout(); close(); }}
						class="dropdown-item"
						type="button"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
							<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
							<path d="M16 17l5-5-5-5" />
							<path d="M21 12H9" />
						</svg>
						<span>Sign Out</span>
					</button>
				{/snippet}
			</DropdownMenu>
		</div>
	{/if}
</nav>

<style>
	.rail {
		width: var(--rail-width, 56px);
		height: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--rail-icon-gap, 4px);
		padding: 12px 0;
		background: var(--rail-bg, #000);
		overflow: hidden;
		transition: width 0.18s ease;

		/* The rail is deliberately theme-invariant chrome - pitch black in
		   both themes, per the design tokens' own --rail-* comment - but
		   generic tokens like --text-primary/--border/--surface flip to
		   light-theme (dark-on-white) values in [data-theme='light'], which
		   are unreadable against a black background. Declare rail-local
		   equivalents pinned to their dark values, and use those (not the
		   ambient tokens) below for anything painted directly on the rail.
		   Deliberately NOT touching --text-primary etc. themselves: the
		   account/create-join dropdowns rendered inside the rail are
		   separate floating panels on their own (correctly theme-following)
		   --panel-bg surface, and shadowing the ambient tokens here would
		   make their text invisible too. */
		--rail-text-primary: #f2f2f5;
		--rail-text-secondary: #a8a8b3;
		--rail-text-muted: #6f6f7a;
		--rail-border-color: rgba(255, 255, 255, 0.08);
		--rail-border-color-hover: rgba(255, 255, 255, 0.14);
		--rail-surface: #151518;
		--rail-surface-hover: #1c1c20;
		--rail-accent: #7c6fee;
		--rail-accent-subtle: rgba(124, 111, 238, 0.14);
	}

	.rail.expanded {
		width: 320px;
		align-items: stretch;
		padding: 0;
	}

	/* ---- Top cluster: brand mark, (expanded: name + add button), toggle ---- */
	.rail-top {
		width: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 0 0 4px;
	}

	.rail.expanded .rail-top {
		flex-direction: row;
		align-items: center;
		gap: 0.625rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--rail-border-color);
	}

	.rail-mark {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--rail-accent-subtle, rgba(255, 255, 255, 0.08));
	}

	.rail-mark img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.rail-brand-name {
		flex: 1;
		min-width: 0;
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--rail-text-primary);
		letter-spacing: -0.02em;
	}

	.icon-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--rail-border-color);
		background: transparent;
		color: var(--rail-text-secondary);
		font-size: 1rem;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.icon-btn:hover {
		background: var(--rail-surface-hover);
		color: var(--rail-text-primary);
	}

	.rail-btn {
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		border-radius: var(--rail-icon-radius, 999px);
		border: none;
		background: transparent;
		color: var(--rail-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		text-decoration: none;
		transition: background var(--duration-base, 0.15s) var(--ease-standard, ease),
			color var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.rail-btn svg {
		width: 16px;
		height: 16px;
	}

	.rail-btn:hover {
		background: var(--rail-icon-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--rail-text-primary);
	}

	.rail-btn.active {
		background: var(--rail-icon-bg-active, #fff);
		color: var(--rail-icon-color-active, #000);
	}

	/* ---- Chat region: the whole point of the merge - this grows to fill
	   the rail, showing icon avatars collapsed or the full list expanded,
	   instead of a second panel appearing next to the rail. ---- */
	.chat-region {
		width: 100%;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.chat-region::-webkit-scrollbar {
		display: none;
	}

	.rail.expanded .chat-region {
		padding: 0.75rem;
	}

	.alert {
		margin: 0.5rem;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 0.5rem;
		color: var(--rail-text-muted);
	}

	/* Collapsed: icon-only chat stack */
	.chat-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
	}

	.chat-avatar {
		position: relative;
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		flex-shrink: 0;
		border: none;
		border-radius: 10px;
		color: #fff;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity var(--duration-base, 0.15s) var(--ease-standard, ease),
			border-radius var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.chat-avatar:hover {
		opacity: 0.85;
	}

	.chat-avatar.active {
		opacity: 1;
		border-radius: 999px;
		box-shadow: 0 0 0 2px var(--rail-bg, #000), 0 0 0 4px var(--rail-icon-bg-active, #fff);
	}

	.unread-dot {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--rail-accent, #7c6fee);
		border: 2px solid var(--rail-bg, #000);
	}

	/* Expanded: full chat-list rows (ported from the old .sidebar) */
	.chats-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chat-item {
		width: 100%;
		padding: 1rem 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--rail-border-color);
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
		background: var(--rail-surface);
		cursor: pointer;
		user-select: none;
		text-align: left;
	}

	.chat-item:hover {
		background: var(--rail-surface-hover);
		border-color: var(--rail-border-color-hover);
		box-shadow: var(--shadow-sm);
	}

	.chat-info {
		flex: 1;
		min-width: 0;
	}

	.chat-name-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
		min-width: 0;
	}

	.chat-name {
		margin: 0;
		color: var(--rail-text-primary);
		font-size: 0.9375rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread-indicator {
		width: 7px;
		height: 7px;
		background: var(--rail-accent);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chat-meta {
		margin: 0;
		color: var(--rail-text-muted);
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-chevron {
		color: var(--rail-text-muted);
		font-size: 1rem;
		opacity: 0.4;
		transition: all 0.15s ease;
	}

	.chat-item:hover .chat-chevron {
		color: var(--rail-accent);
		opacity: 1;
		transform: translateX(2px);
	}

	.chat-item.selected,
	.chat-item.open {
		border-color: var(--rail-accent);
		background: var(--rail-accent-subtle);
	}

	.chat-item.selected .chat-chevron,
	.chat-item.open .chat-chevron {
		color: var(--rail-accent);
		opacity: 1;
	}

	/* ---- Bottom: account footer ---- */
	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.rail-avatar {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: none;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		font-family: inherit;
		color: var(--accent-contrast, #fff);
		background: var(--rail-accent, #7c6fee);
		cursor: pointer;
		margin-top: 4px;
		transition: transform var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.rail-avatar:hover {
		transform: scale(1.06);
	}

	/* ThemeToggle has no styles of its own - it relies on the global
	   .theme-toggle class (static/global.css), whose border/background/
	   color are the same theme-following tokens responsible for the
	   sign-out/chat-name legibility bug above. Override it here (both the
	   collapsed .rail-bottom and expanded .rail-user place one) so it
	   reads correctly against the black rail in light theme. */
	.rail :global(.theme-toggle) {
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		border: none;
		background: transparent;
		color: var(--rail-text-secondary);
	}

	.rail :global(.theme-toggle svg) {
		width: 20px;
		height: 20px;
	}

	.rail :global(.theme-toggle:hover) {
		border-color: transparent;
		background: var(--rail-icon-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--rail-text-primary);
	}

	.rail-footer {
		width: 100%;
		flex-shrink: 0;
		padding: 0.75rem;
		border-top: 1px solid var(--rail-border-color);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.nav-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5625rem 0.625rem;
		border: none;
		background: transparent;
		border-radius: var(--radius-sm);
		color: var(--rail-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.nav-item svg {
		flex-shrink: 0;
	}

	.nav-item:hover {
		background: var(--rail-surface-hover);
		color: var(--rail-text-primary);
	}

	.rail-user {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem 0.625rem;
	}

	.user-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--rail-accent-subtle);
		color: var(--rail-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.8125rem;
		flex-shrink: 0;
	}

	.user-meta {
		flex: 1;
		min-width: 0;
	}

	.user-name {
		color: var(--rail-text-primary);
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* On mobile the rail is forced expanded (see (app)/+layout.svelte's
	   isMobile handling) and stretched to full width by that same file's
	   media query - there's no collapsed state to toggle back to, so the
	   toggle button is just noise. */
	@media (max-width: 768px) {
		.toggle-btn {
			display: none;
		}

		/* Same specificity tier as the base .rail.expanded rule above (both
		   carry the component's scoping class), so this has to live here
		   to actually win - an override from outside this component would
		   need :global() and still lose the specificity fight. */
		.rail.expanded {
			width: 100%;
		}

		.rail.expanded .rail-top {
			padding: 0.75rem 1rem;
		}

		.rail.expanded .chat-region {
			padding: 0.75rem 1rem;
		}

		.rail.expanded .chat-item {
			padding: 0.875rem 1rem;
		}
	}

	@media (max-width: 480px) {
		.rail-brand-name {
			font-size: 1rem;
		}
	}
</style>

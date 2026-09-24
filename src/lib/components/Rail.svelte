<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import type { Chat } from '$lib/types/chat';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { colorForChat } from '$lib/utils/chatAvatar';
	import { formatRelativeShort } from '$lib/utils/time';

	interface Props {
		chats: Chat[];
		activeChatId?: string;
		unreadMap?: Record<string, boolean>;
		isLoading: boolean;
		error: string | null;
		selectedChatIndex: number;
		expanded: boolean;
		appVersion?: string;
		showDownload?: boolean;
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
		appVersion = '',
		showDownload = false,
		onToggleExpanded,
		onSelectChat,
		onOpenCreateModal,
		onOpenJoinModal,
		onLogout
	}: Props = $props();

	const username = $derived($authStore.user?.username ?? '');
	const initial = $derived((username || '?').charAt(0).toUpperCase());
	// Release builds report a semver ("1.2.3" -> "v1.2.3"); dev builds a commit hash.
	const versionLabel = $derived(/^\d/.test(appVersion) ? `v${appVersion}` : appVersion);

	let query = $state('');
	const filteredChats = $derived(
		query.trim()
			? chats.filter(chat => chat.name.toLowerCase().includes(query.trim().toLowerCase()))
			: chats
	);
	// Keyboard selection (↑/↓ in the layout) indexes the unfiltered list -
	// track it by id so it still highlights the right row while filtering.
	const selectedChatId = $derived(chats[selectedChatIndex]?.id);

	// Relative timestamps ("5m", "2h") need to tick on their own.
	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(id);
	});

	function activityLabel(chat: Chat): string {
		return formatRelativeShort(chat.lastMessageAt ?? chat.createdAt, now);
	}
</script>

{#snippet createJoinItems(close: () => void)}
	<button onclick={() => { onOpenCreateModal(); close(); }} class="dropdown-item" type="button">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
			<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
		</svg>
		<span>Create a chat</span>
		<kbd>C</kbd>
	</button>
	<button onclick={() => { onOpenJoinModal(); close(); }} class="dropdown-item" type="button">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
			<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
		</svg>
		<span>Join with code</span>
		<kbd>J</kbd>
	</button>
{/snippet}

{#snippet accountMenu(close: () => void)}
	<div class="dropdown-header">
		<div class="account-avatar lg">{initial}</div>
		<div class="account-meta">
			<span class="account-name">{username}</span>
			{#if $authStore.user?.email}
				<span class="account-email">{$authStore.user.email}</span>
			{/if}
		</div>
	</div>
	<div class="dropdown-separator"></div>
	<button onclick={() => toggleTheme()} class="dropdown-item" type="button">
		{#if $theme === 'dark'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
				<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
			</svg>
			<span>Light mode</span>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
				<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
			</svg>
			<span>Dark mode</span>
		{/if}
	</button>
	{#if showDownload}
		<a href={resolve('/download')} class="dropdown-item" onclick={close}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
				<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
			</svg>
			<span>Get the desktop app</span>
		</a>
	{/if}
	<div class="dropdown-separator"></div>
	<button onclick={() => { onLogout(); close(); }} class="dropdown-item danger" type="button">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
			<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
		</svg>
		<span>Sign out</span>
	</button>
	<div class="dropdown-footer">
		© {new Date().getFullYear()} Lhamacorp{versionLabel ? ` · ${versionLabel}` : ''}
	</div>
{/snippet}

<nav class="rail" class:expanded aria-label="Chats">
	<!-- ---- Header ---- -->
	<div class="rail-top">
		<div class="brand">
			<img class="brand-mark" src="/logo.png" alt="" />
			{#if expanded}
				<span class="brand-name">Chat</span>
			{/if}
		</div>

		{#if expanded}
			<div class="top-actions">
				<DropdownMenu width="200px">
					{#snippet trigger({ toggle })}
						<button onclick={toggle} class="icon-button" title="New chat" aria-label="New chat" type="button">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
								<path d="M12 5v14M5 12h14" />
							</svg>
						</button>
					{/snippet}
					{#snippet children({ close })}
						{@render createJoinItems(close)}
					{/snippet}
				</DropdownMenu>
				<button
					class="icon-button toggle-btn"
					type="button"
					onclick={onToggleExpanded}
					title="Collapse sidebar"
					aria-label="Collapse sidebar"
					aria-expanded="true"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
						<rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" />
					</svg>
				</button>
			</div>
		{:else}
			<button
				class="icon-button toggle-btn"
				type="button"
				onclick={onToggleExpanded}
				title="Expand sidebar"
				aria-label="Expand sidebar"
				aria-expanded="false"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
					<rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" />
				</svg>
			</button>
		{/if}
	</div>

	{#if expanded && chats.length > 0}
		<div class="search">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true">
				<circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
			</svg>
			<input
				type="search"
				placeholder="Search chats"
				aria-label="Search chats"
				bind:value={query}
				onkeydown={e => {
					if (e.key === 'Escape') {
						query = '';
						(e.currentTarget as HTMLInputElement).blur();
					} else if (e.key === 'Enter' && filteredChats.length > 0) {
						onSelectChat(filteredChats[0].id);
						query = '';
						(e.currentTarget as HTMLInputElement).blur();
					}
				}}
			/>
		</div>
	{/if}

	<!-- ---- Chat list ---- -->
	<div class="chat-region">
		{#if error}
			<div class="alert alert-error">{error}</div>
		{/if}

		{#if isLoading}
			<div class="loading-container">
				<LoadingSpinner size="sm" />
			</div>
		{:else if expanded}
			{#if chats.length > 0}
				<div class="section-label">Chats</div>
				<ul class="chats-list">
					{#each filteredChats as chat (chat.id)}
						{@const unread = !!unreadMap[chat.id]}
						<li>
							<button
								class="chat-item"
								class:selected={chat.id === selectedChatId}
								class:open={chat.id === activeChatId}
								class:unread
								onclick={() => onSelectChat(chat.id)}
								aria-current={chat.id === activeChatId ? 'page' : undefined}
								type="button"
							>
								<span class="chat-avatar" style={`--avatar-color: ${colorForChat(chat.id)}`}>
									{chat.name.charAt(0).toUpperCase()}
								</span>
								<span class="chat-info">
									<span class="chat-row">
										<span class="chat-name">{chat.name}</span>
										<span class="chat-time">{activityLabel(chat)}</span>
									</span>
									<span class="chat-row">
										<span class="chat-meta">
											{chat.members.length} member{chat.members.length === 1 ? '' : 's'}
										</span>
										{#if unread}
											<span class="unread-dot" aria-label="Unread messages"></span>
										{/if}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if filteredChats.length === 0}
					<p class="no-results">No chats match “{query}”</p>
				{/if}
			{:else if !error}
				<div class="list-empty">
					<div class="list-empty-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
							<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
						</svg>
					</div>
					<p class="list-empty-title">No chats yet</p>
					<p class="list-empty-text">Start a conversation or join one with an invite code.</p>
					<div class="list-empty-actions">
						<button class="btn btn-primary" type="button" onclick={onOpenCreateModal}>Create chat</button>
						<button class="btn btn-ghost" type="button" onclick={onOpenJoinModal}>Join</button>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Collapsed: avatar stack, plus a persistent add button - the
			     only way to create/join while collapsed. -->
			<div class="chat-stack">
				{#each chats as chat (chat.id)}
					<button
						class="stack-avatar"
						class:active={chat.id === activeChatId}
						type="button"
						onclick={() => onSelectChat(chat.id)}
						title={chat.name}
						aria-label={chat.name}
						style={`--avatar-color: ${colorForChat(chat.id)}`}
					>
						{chat.name.charAt(0).toUpperCase()}
						{#if unreadMap[chat.id]}
							<span class="stack-unread" aria-label="Unread messages"></span>
						{/if}
					</button>
				{/each}
				<DropdownMenu placement="right" width="200px">
					{#snippet trigger({ toggle })}
						<button onclick={toggle} class="stack-avatar add-chat-btn" title="New chat" aria-label="New chat" type="button">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="16" height="16" aria-hidden="true">
								<path d="M12 5v14M5 12h14" />
							</svg>
						</button>
					{/snippet}
					{#snippet children({ close })}
						{@render createJoinItems(close)}
					{/snippet}
				</DropdownMenu>
			</div>
		{/if}
	</div>

	<!-- ---- Account ---- -->
	<div class="rail-footer">
		<DropdownMenu placement={expanded ? 'top' : 'right'} align="left" width="240px">
			{#snippet trigger({ toggle, open })}
				<button
					class="account-trigger"
					class:open
					type="button"
					onclick={toggle}
					title={expanded ? undefined : username}
					aria-label="Account menu"
				>
					<span class="account-avatar">{initial}</span>
					{#if expanded}
						<span class="account-name">{username}</span>
						<svg class="account-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
							<path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" />
						</svg>
					{/if}
				</button>
			{/snippet}
			{#snippet children({ close })}
				{@render accountMenu(close)}
			{/snippet}
		</DropdownMenu>
	</div>
</nav>

<style>
	.rail {
		width: 68px;
		height: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--sidebar-bg);
		border-right: 1px solid var(--sidebar-border);
		overflow: hidden;
		transition: width 0.22s var(--ease-out-expo);
	}

	.rail.expanded {
		width: 288px;
		align-items: stretch;
	}

	/* ---- Header ---- */
	.rail-top {
		width: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 0 0.5rem;
		padding-top: calc(0.875rem + env(safe-area-inset-top));
	}

	.rail.expanded .rail-top {
		flex-direction: row;
		justify-content: space-between;
		padding: 0.875rem 0.75rem 0.625rem 1rem;
		padding-top: calc(0.875rem + env(safe-area-inset-top));
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}

	.brand-mark {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.brand-name {
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.rail .icon-button:hover:not(:disabled) {
		background: var(--sidebar-item-active);
	}

	/* ---- Search ---- */
	.search {
		position: relative;
		margin: 0.125rem 0.75rem 0.5rem;
		flex-shrink: 0;
	}

	.search svg {
		position: absolute;
		left: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.search input {
		height: 2.125rem;
		padding: 0 0.75rem 0 2rem;
		font-size: 0.8125rem;
		background: var(--sidebar-item-hover);
		border-color: transparent;
		border-radius: var(--radius-sm);
	}

	.search input:hover:not(:focus) {
		border-color: var(--border);
	}

	.search input:focus {
		background: var(--surface);
	}

	.search input::-webkit-search-cancel-button {
		display: none;
	}

	/* ---- Chat region ---- */
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
		padding: 0.25rem 0.5rem 0.75rem;
	}

	.alert {
		margin: 0.5rem;
	}

	.loading-container {
		display: flex;
		justify-content: center;
		padding: 2rem 0.5rem;
		color: var(--text-muted);
	}

	.section-label {
		padding: 0.5rem 0.625rem 0.375rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.chats-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.chat-item {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.625rem;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.12s ease;
	}

	.chat-item:hover {
		background: var(--sidebar-item-hover);
	}

	.chat-item.selected {
		background: var(--sidebar-item-hover);
		box-shadow: inset 0 0 0 1px var(--border-hover);
	}

	.chat-item.open {
		background: var(--sidebar-item-active);
	}

	.chat-item.open::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 25%;
		bottom: 25%;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--accent);
	}

	.chat-avatar,
	.stack-avatar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 650;
		color: color-mix(in srgb, var(--avatar-color) var(--identity-ink, 100%), #000);
		background: color-mix(in srgb, var(--avatar-color) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--avatar-color) 22%, transparent);
	}

	.chat-avatar {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		font-size: 0.875rem;
	}

	.chat-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.chat-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}

	.chat-name {
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-name::before {
		content: '#';
		margin-right: 0.125rem;
		color: var(--text-muted);
		font-weight: 400;
	}

	.chat-item.unread .chat-name {
		font-weight: 650;
	}

	.chat-time {
		flex-shrink: 0;
		font-size: 0.6875rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.chat-item.unread .chat-time {
		color: var(--accent);
		font-weight: 600;
	}

	.chat-meta {
		min-width: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-item.unread .chat-meta {
		color: var(--text-secondary);
	}

	.unread-dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-subtle);
	}

	.no-results {
		padding: 1rem 0.625rem;
		margin: 0;
		font-size: 0.8125rem;
		color: var(--text-muted);
		text-align: center;
	}

	/* Empty list */
	.list-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2.5rem 1rem;
	}

	.list-empty-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		background: var(--accent-subtle);
		margin-bottom: 0.875rem;
	}

	.list-empty-title {
		margin: 0 0 0.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.list-empty-text {
		margin: 0 0 1rem;
		font-size: 0.8125rem;
		color: var(--text-muted);
		max-width: 220px;
	}

	.list-empty-actions {
		display: flex;
		gap: 0.5rem;
	}

	.list-empty-actions .btn {
		height: 2rem;
		font-size: 0.8125rem;
	}

	/* ---- Collapsed stack ---- */
	.chat-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.stack-avatar {
		position: relative;
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 12px;
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
		transition: border-radius 0.2s var(--ease-out-expo), transform 0.12s ease;
	}

	.stack-avatar:hover {
		border-radius: 14px;
		transform: translateY(-1px);
	}

	.stack-avatar.active {
		box-shadow: 0 0 0 2px var(--sidebar-bg), 0 0 0 4px var(--avatar-color);
	}

	.stack-avatar.add-chat-btn {
		--avatar-color: var(--text-muted);
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--border-hover);
		color: var(--text-secondary);
	}

	.stack-avatar.add-chat-btn:hover {
		color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.stack-unread {
		position: absolute;
		top: -3px;
		right: -3px;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid var(--sidebar-bg);
	}

	/* ---- Account footer ---- */
	.rail-footer {
		width: 100%;
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: 0.625rem 0.5rem;
		padding-bottom: calc(0.625rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--sidebar-border);
	}

	.rail-footer :global(.dropdown-root) {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.account-trigger {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.12s ease;
	}

	.rail.expanded .account-trigger {
		width: 100%;
		padding: 0.4375rem 0.5rem;
	}

	.account-trigger:hover,
	.account-trigger.open {
		background: var(--sidebar-item-hover);
	}

	.account-avatar {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8125rem;
		font-weight: 650;
		color: #fff;
		background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #ff6fa8));
	}

	.account-avatar.lg {
		width: 36px;
		height: 36px;
		font-size: 0.9375rem;
	}

	.account-trigger .account-name {
		flex: 1;
		min-width: 0;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 550;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.account-chevron {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	/* Account menu content (portaled into the dropdown) */
	:global(.dropdown-menu) .account-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	:global(.dropdown-menu) .account-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.dropdown-menu) .account-email {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---- Mobile: the rail is the whole list screen ---- */
	@media (max-width: 768px) {
		.toggle-btn {
			display: none;
		}

		.rail.expanded {
			width: 100%;
			border-right: none;
		}

		.rail.expanded .rail-top {
			padding-left: 1rem;
			padding-right: 0.75rem;
		}

		.brand-name {
			font-size: 1.25rem;
		}

		.search {
			margin-left: 1rem;
			margin-right: 1rem;
		}

		.search input {
			height: 2.5rem;
			font-size: 0.9375rem;
		}

		.rail.expanded .chat-region {
			padding: 0.25rem 0.5rem 1rem;
		}

		.chat-item {
			padding: 0.625rem 0.5rem;
			gap: 0.875rem;
		}

		.chat-item.open::before {
			display: none;
		}

		.chat-avatar {
			width: 46px;
			height: 46px;
			border-radius: 14px;
			font-size: 1rem;
		}

		.chat-name {
			font-size: 0.9688rem;
		}

		.chat-meta {
			font-size: 0.8125rem;
		}
	}
</style>

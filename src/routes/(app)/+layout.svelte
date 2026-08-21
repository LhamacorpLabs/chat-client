<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { authStore, authLoaded, logout, getValidToken } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import type { Chat } from '$lib/types/chat';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { chatNotifications } from '$lib/stores/chatNotifications';
	import { metadataPollingService } from '$lib/services/metadataPolling';
	import { PUBLIC_CHAT_API_URL } from '$env/static/public';
	import { cleanupAllChatData, schedulePeriodicCleanup } from '$lib/utils/localStorageCleanup';
	import Modal from '$lib/components/ui/Modal.svelte';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let { children } = $props();

	let showCreateModal = $state(false);
	let showJoinModal = $state(false);
	let newChatName = $state('');
	let invitationCode = $state('');
	let isJoining = $state(false);
	let joinError = $state<string | null>(null);
	let selectedChatIndex = $state(-1);
	let backendVersion = $state('');
	let appVersion = $state('');
	let isElectron = $state(typeof window !== 'undefined' && !!window.electronAPI);

	// Whether the sidebar is manually collapsed (desktop only - on mobile,
	// visibility is still driven purely by the route, see isChatRoute below).
	let sidebarCollapsed = $state(
		typeof window !== 'undefined' && localStorage.getItem('sidebarCollapsed') === 'true'
	);

	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
		}
	});

	// The currently open chat, if any - drives both the mobile show/hide
	// (list vs. conversation) and highlighting the open chat in the list.
	let openChatId = $derived(page.params.chatId as string | undefined);
	let isChatRoute = $derived(!!openChatId);

	$effect(() => {
		if ($authLoaded && !$authStore.token) {
			clearChats();
			goto('/login');
		}
	});

	$effect(() => {
		chatNotifications.initialize();
		fetchBackendVersion();
		initializeAppVersion();

		// Schedule periodic localStorage cleanup
		schedulePeriodicCleanup();
	});

	let chatsLoaded = $state(false);

	$effect(() => {
		const hasAuth = !!$authStore.token && !!$authStore.user;
		if (hasAuth) {
			if (!chatsLoaded) {
				chatsLoaded = true;
				untrack(async () => {
					const token = await getValidToken();
					if (token) {
						await fetchChats(token, false);
					}
				});
			}
		} else {
			chatsLoaded = false;
			metadataPollingService.stop();
			chatNotifications.clear();
		}

		return () => {
			metadataPollingService.stop();
		};
	});

	$effect(() => {
		if ($authStore.token && $authStore.user && $chatStore.chats.length > 0) {
			const chatIds = $chatStore.chats.map(chat => chat.id);
			metadataPollingService.start(chatIds);

			// Clean up localStorage data for inactive chats
			cleanupAllChatData(chatIds);
		} else if ($chatStore.chats.length === 0) {
			// No chats to poll
			metadataPollingService.stop();
		}
	});

	async function handleCreateChat() {
		if (!$authStore.token || !newChatName.trim()) return;

		const token = await getValidToken();
		if (!token) return;

		const success = await createChat(token, { name: newChatName.trim() });
		if (success) {
			newChatName = '';
			showCreateModal = false;
		}
	}

	function openCreateModal() {
		showCreateModal = true;
		newChatName = '';
	}

	function closeCreateModal() {
		showCreateModal = false;
		newChatName = '';
	}

	function openChat(chatId: string) {
		goto(`/chat/${chatId}`);
	}

	async function handleJoinChat() {
		if (!$authStore.token || !invitationCode.trim()) return;

		const token = await getValidToken();
		if (!token) return;

		isJoining = true;
		joinError = null;

		try {
			await redeemInvitation(token, { code: invitationCode.trim() });
			await fetchChats(token);
			invitationCode = '';
			showJoinModal = false;
		} catch (err) {
			joinError = err instanceof Error ? err.message : 'Failed to join chat';
		} finally {
			isJoining = false;
		}
	}

	function openJoinModal() {
		showJoinModal = true;
		invitationCode = '';
		joinError = null;
	}

	function closeJoinModal() {
		showJoinModal = false;
		invitationCode = '';
		joinError = null;
	}

	async function fetchBackendVersion() {
		try {
			const response = await fetch(`${PUBLIC_CHAT_API_URL}/actuator/info`);
			if (response.ok) {
				const data = await response.json();
				const commitId = data.git?.commit?.id;
				if (commitId) {
					backendVersion = `be:${commitId}`;
				}
			}
		} catch (error) {
			console.error('Failed to fetch backend version:', error);
		}
	}

	function initializeAppVersion() {
		try {
			appVersion = __APP_VERSION__;
		} catch (error) {
			console.error('Failed to get app version:', error);
		}
	}

	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const isModalOpen = showCreateModal || showJoinModal;
			const isTyping = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

			if (isModalOpen || isTyping) {
				if (event.key === 'Escape') {
					if (showCreateModal) closeCreateModal();
					if (showJoinModal) closeJoinModal();
				}
				return;
			}

			const chats = $chatStore.chats;

			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault();
					if (chats.length > 0) {
						selectedChatIndex = Math.min(selectedChatIndex + 1, chats.length - 1);
					}
					break;
				case 'ArrowUp':
					event.preventDefault();
					if (chats.length > 0) {
						selectedChatIndex = Math.max(selectedChatIndex - 1, 0);
					}
					break;
				case 'Enter':
					event.preventDefault();
					if (selectedChatIndex >= 0 && selectedChatIndex < chats.length) {
						openChat(chats[selectedChatIndex].id);
					}
					break;
				case 'c':
					event.preventDefault();
					openCreateModal();
					break;
				case 'j':
					event.preventDefault();
					openJoinModal();
					break;
			}
		}

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if $authStore.user}
	<div class="app-shell" class:chat-open={isChatRoute} class:sidebar-collapsed={sidebarCollapsed && isChatRoute}>
		<div class="shell-row">
		<!-- Shown in place of the sidebar on desktop when it's collapsed,
		     so there's always a way to bring it back. -->
		<button
			class="btn btn-ghost sidebar-expand-btn"
			onclick={() => (sidebarCollapsed = false)}
			title="Show chat list"
			aria-label="Show chat list"
			type="button"
		>☰</button>

		<!-- Sidebar - the chat list itself, WhatsApp-style. Stays mounted
		     across chat navigation so switching chats is instant. -->
		<aside class="sidebar">
			<div class="sidebar-header">
				<div class="sidebar-brand">
					<img src="/logo.png" alt="" class="brand-icon" />
					<span class="brand-name">Chat</span>
				</div>
				<div class="sidebar-header-actions">
					<DropdownMenu width="120px">
						{#snippet trigger({ toggle })}
							<button
								onclick={toggle}
								class="btn btn-ghost add-btn"
								title="Create or join a chat"
								type="button"
							>+</button>
						{/snippet}
						{#snippet children({ close })}
							<button
								onclick={() => { openCreateModal(); close(); }}
								class="dropdown-item"
								type="button"
							>
								<span>Create</span>
							</button>
							<button
								onclick={() => { openJoinModal(); close(); }}
								class="dropdown-item"
								type="button"
							>
								<span>Join</span>
							</button>
						{/snippet}
					</DropdownMenu>
					<button
						class="btn btn-ghost collapse-btn"
						onclick={() => (sidebarCollapsed = true)}
						title="Hide chat list"
						aria-label="Hide chat list"
						type="button"
					>«</button>
				</div>
			</div>

			<div class="sidebar-list">
				<!-- Error Message -->
				{#if $chatStore.error}
					<div class="alert alert-error">
						{$chatStore.error}
					</div>
				{/if}

				<!-- Loading State -->
				{#if $chatStore.isLoading}
					<div class="loading-container">
						<LoadingSpinner label="Loading your chats..." />
					</div>
				{/if}

				<!-- Chats List -->
				{#if !$chatStore.isLoading && $chatStore.chats.length > 0}
					<div class="chats-list">
						{#each $chatStore.chats as chat, index (chat.id)}
							<button
								class="chat-item card clickable"
								class:selected={index === selectedChatIndex}
								class:open={chat.id === openChatId}
								onclick={() => openChat(chat.id)}
								type="button"
							>
								<div class="chat-info">
									<div class="chat-name-container">
										<h3 class="chat-name">#{chat.name}</h3>
										{#if $chatNotifications.hasUnreadMessages[chat.id]}
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
								<div class="chat-chevron">
									→
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Empty State -->
				{#if !$chatStore.isLoading && $chatStore.chats.length === 0 && !$chatStore.error}
					<EmptyState
						icon="💬"
						title="No chats yet"
						description={'Create your first chat or join one with an invitation code using the "+" button above!'}
					/>
				{/if}
			</div>

			<div class="sidebar-footer">
				<button class="nav-item" onclick={() => logout()} type="button">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
						<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
						<path d="M16 17l5-5-5-5" />
						<path d="M21 12H9" />
					</svg>
					<span>Sign Out</span>
				</button>
				<div class="sidebar-user">
					<div class="user-avatar">{($authStore.user?.username ?? '?').charAt(0).toUpperCase()}</div>
					<div class="user-meta">
						<div class="user-name">@{$authStore.user?.username}</div>
					</div>
					<ThemeToggle />
				</div>
			</div>
		</aside>

		<!-- Main column - the active route renders here. On desktop this
		     sits beside the sidebar at all times; on mobile it only takes
		     over the full screen while a chat is open (WhatsApp's mobile
		     behavior), and the list route below just never shows it. -->
		<div class="shell-main">
			{@render children()}
		</div>
		</div>

		<footer class="app-footer">
			©<span id="year"></span> Lhamacorp <script> document.getElementById('year').textContent = new Date().getFullYear(); </script>
			{#if appVersion || backendVersion}
				<span class="version-info">
					{#if appVersion} • v{appVersion}{/if}
				</span>
			{/if}
			{#if !isElectron}
				<a href="/download" class="download-link">• Download Client</a>
			{/if}
		</footer>

		<!-- Create Chat Modal -->
		{#if showCreateModal}
			<Modal title="Create New Chat" onClose={closeCreateModal}>
				<p class="modal-description">Enter a name for your new chat:</p>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateChat(); }}>
					{#key showCreateModal}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={newChatName}
						placeholder="Enter chat name..."
						required
						disabled={$chatStore.isCreating}
						class="modal-input"
						autofocus
					/>
					{/key}
					<div class="modal-actions">
						<button
							type="button"
							onclick={closeCreateModal}
							class="btn btn-ghost"
							disabled={$chatStore.isCreating}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={$chatStore.isCreating || !newChatName.trim()}
						>
							{$chatStore.isCreating ? 'Creating...' : 'Create Chat'}
						</button>
					</div>
				</form>
			</Modal>
		{/if}

		<!-- Join Chat Modal -->
		{#if showJoinModal}
			<Modal title="Join Chat" onClose={closeJoinModal}>
				<p class="modal-description">Enter the invitation code to join a chat:</p>
				<form onsubmit={(e) => { e.preventDefault(); handleJoinChat(); }}>
					{#key showJoinModal}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={invitationCode}
						placeholder="Enter invitation code..."
						required
						disabled={isJoining}
						class="modal-input"
						autofocus
					/>
					{/key}
					{#if joinError}
						<div class="alert alert-error modal-error">
							{joinError}
						</div>
					{/if}
					<div class="modal-actions">
						<button
							type="button"
							onclick={closeJoinModal}
							class="btn btn-ghost"
							disabled={isJoining}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={isJoining || !invitationCode.trim()}
						>
							{isJoining ? 'Joining...' : 'Join Chat'}
						</button>
					</div>
				</form>
			</Modal>
		{/if}
	</div>
{:else}
	<div class="loading-screen">
		<LoadingSpinner size="lg" label="Loading..." />
	</div>
{/if}

<style>
	.app-shell {
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		gap: var(--gap);
		padding: var(--gap);
		padding-bottom: 0;
	}

	.shell-row {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: var(--gap);
	}

	/* Sidebar - the chat list panel, WhatsApp-style */
	.sidebar {
		width: 340px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.sidebar-header {
		flex-shrink: 0;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.brand-icon {
		width: 28px;
		height: 28px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.brand-name {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
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
		color: var(--text-secondary);
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
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.sidebar-footer {
		flex-shrink: 0;
		padding: 0.75rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.sidebar-user {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem 0.625rem;
	}

	.user-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--accent-subtle);
		color: var(--accent);
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
		color: var(--text-primary);
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.add-btn {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	.sidebar-header-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* Only relevant once a chat is open, and desktop-only like
	   .sidebar-expand-btn below - on mobile the sidebar is already
	   collapsible by navigating into a chat. */
	.collapse-btn {
		display: none;
		font-size: 0.9375rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	/* Stand-in for the sidebar on desktop once it's collapsed - hidden by
	   default, shown by the min-width media query below. */
	.sidebar-expand-btn {
		display: none;
		flex-shrink: 0;
		align-self: flex-start;
		width: 40px;
		height: 40px;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		padding: 0;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
	}

	@media (min-width: 769px) {
		.app-shell.chat-open .collapse-btn {
			display: inline-flex;
		}

		.app-shell.sidebar-collapsed .sidebar {
			display: none;
		}

		.app-shell.sidebar-collapsed .sidebar-expand-btn {
			display: flex;
		}
	}

	/* Chat list scroll area, inside the sidebar */
	.sidebar-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0.75rem;
	}

	/* Main column - just a sizing container. The active route (the "select
	   a chat" placeholder, or the chat view) provides its own floating
	   panel look, same as the sidebar, so this stays unstyled. */
	.shell-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	/* Footer - plain text below the panels, not a panel itself */
	.app-footer {
		flex-shrink: 0;
		padding: 0.75rem 1.5rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
		text-align: center;
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.version-info {
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.download-link {
		color: var(--text-muted);
		font-size: 0.7rem;
		text-decoration: none;
		margin-left: 0.25rem;
	}

	.download-link:hover {
		color: var(--text-primary);
	}

	/* Loading Container */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	/* Chat List */
	.chats-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chat-item {
		padding: 1rem 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
		background: var(--surface);
	}

	.chat-item.clickable {
		cursor: pointer;
		user-select: none;
	}

	.chat-item:hover {
		background: var(--surface-hover);
		border-color: var(--border-hover);
	}

	.chat-item.clickable:hover {
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
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread-indicator {
		width: 7px;
		height: 7px;
		background: var(--accent);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chat-meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-chevron {
		color: var(--text-muted);
		font-size: 1rem;
		opacity: 0.4;
		transition: all 0.15s ease;
	}

	.chat-item.clickable:hover .chat-chevron {
		color: var(--accent);
		opacity: 1;
		transform: translateX(2px);
	}

	/* Highlight the chat that's currently selected via keyboard nav, or
	   currently open in the main column */
	.chat-item.selected,
	.chat-item.open {
		border-color: var(--accent);
		background: var(--accent-subtle);
	}

	.chat-item.selected .chat-chevron,
	.chat-item.open .chat-chevron {
		color: var(--accent);
		opacity: 1;
	}

	/* Loading Screen - shown full-viewport while auth is still hydrating,
	   before the shell itself renders */
	.loading-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		min-height: 100dvh;
		color: var(--text-muted);
	}

	/* Modal chrome (overlay/content/header/close button) now lives in the
	   shared Modal component - the rules below only style the form content
	   this page passes into the modal's body. */
	.modal-description {
		margin: 0 0 1rem 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.modal-input {
		width: 100%;
		margin-bottom: 0.75rem;
	}

	.modal-error {
		margin-bottom: 0.75rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.25rem;
	}

	.modal-actions button {
		min-width: 80px;
	}

	/* Responsive Design - on mobile the shell only ever shows one pane at a
	   time, WhatsApp-style: the chat list by default, or the open chat
	   (full-screen) while chat-open is set. */
	@media (max-width: 768px) {
		.app-shell {
			gap: 0;
			padding: 0;
		}

		.shell-row {
			gap: 0;
		}

		.sidebar {
			width: 100%;
			border-radius: 0;
			box-shadow: none;
		}

		.shell-main {
			display: none;
		}

		.app-footer {
			display: none;
		}

		.sidebar-header {
			padding: 0.75rem 1rem;
		}

		.sidebar-list {
			padding: 0.75rem 1rem;
		}

		.chat-item {
			padding: 0.875rem 1rem;
		}

		.app-shell.chat-open .sidebar {
			display: none;
		}

		.app-shell.chat-open .shell-main {
			display: flex;
			width: 100%;
		}
	}

	@media (max-width: 480px) {
		.brand-name {
			font-size: 1rem;
		}
	}
</style>

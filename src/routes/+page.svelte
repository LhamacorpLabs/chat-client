<script lang="ts">
	import { untrack } from 'svelte';
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
	let sidebarOpen = $state(false);

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
		sidebarOpen = false;
		goto(`/chat/${chatId}`);
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
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

			if (sidebarOpen && event.key === 'Escape') {
				closeSidebar();
				return;
			}

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
	<div class="app-shell">
		<!-- Mobile sidebar toggle -->
		<button
			class="sidebar-toggle"
			onclick={toggleSidebar}
			aria-label="Toggle menu"
			aria-expanded={sidebarOpen}
			type="button"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
				<path d="M3 6h18M3 12h18M3 18h18" />
			</svg>
		</button>
		<button
			class="sidebar-overlay"
			class:active={sidebarOpen}
			onclick={closeSidebar}
			aria-label="Close menu"
			tabindex={sidebarOpen ? 0 : -1}
		></button>

		<div class="shell-row">
		<!-- Sidebar -->
		<aside class="sidebar" class:open={sidebarOpen}>
			<div class="sidebar-header">
				<div class="sidebar-brand">
					<img src="/logo.png" alt="" class="brand-icon" />
					<span class="brand-name">Chat</span>
				</div>
			</div>

			<nav class="sidebar-nav">
				<div class="nav-section-label label-upper">Menu</div>
				<button class="nav-item active" type="button">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
						<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
					</svg>
					<span>Chats</span>
				</button>
			</nav>

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

		<!-- Main column -->
		<div class="shell-main">
			<header class="content-header">
				<div class="content-heading">
					<h1>Your Chats</h1>
					<p class="content-subtitle">Your conversations and groups</p>
				</div>
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
			</header>

			<!-- Main Content -->
			<main class="main-content">
				<div class="chats-container">
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
								<button class="chat-item card clickable" class:selected={index === selectedChatIndex} onclick={() => openChat(chat.id)} type="button">
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
			</main>
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

	/* Sidebar - floating panel, matches the main-content panel treatment */
	.sidebar {
		width: 240px;
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
		padding: 1.25rem 1.25rem 1rem;
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

	.sidebar-nav {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1rem 0.75rem;
	}

	.nav-section-label {
		padding: 0 0.625rem;
		margin-bottom: 0.5rem;
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

	.nav-item.active {
		background: var(--accent-subtle);
		color: var(--accent);
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

	.user-role {
		color: var(--text-muted);
		font-size: 0.6875rem;
		text-transform: capitalize;
	}

	/* Mobile sidebar toggle + overlay (hidden on desktop) */
	.sidebar-toggle {
		display: none;
		position: fixed;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 200;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
	}

	.sidebar-overlay {
		display: none;
		position: fixed;
		inset: 0;
		border: none;
		padding: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 99;
		cursor: pointer;
	}

	/* Main column - floating panel, same treatment as the sidebar */
	.shell-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--panel-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.content-header {
		flex-shrink: 0;
		padding: 1.25rem 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.content-heading h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.content-subtitle {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.8125rem;
	}

	.add-btn {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.main-content > .chats-container {
		max-width: 640px;
		margin: 0 auto;
		padding: 1.5rem;
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
	}

	.chat-name-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.chat-name {
		margin: 0;
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 600;
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

	/* Selected state for keyboard navigation */
	.chat-item.selected {
		border-color: var(--accent);
		background: var(--accent-subtle);
	}

	.chat-item.selected .chat-chevron {
		color: var(--accent);
		opacity: 1;
	}

	/* Loading Screen */
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

	/* Responsive Design - sidebar collapses into an off-canvas drawer */
	/* Responsive Design - collapse floating panels to edge-to-edge; the
	   sidebar becomes an off-canvas drawer since it can't sit permanently
	   alongside the content on a small screen. */
	@media (max-width: 768px) {
		.app-shell {
			gap: 0;
			padding: 0;
		}

		.shell-row {
			gap: 0;
		}

		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 150;
			border-radius: 0;
			border-top: none;
			border-bottom: none;
			border-left: none;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
			box-shadow: var(--shadow-lg);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-toggle {
			display: flex;
		}

		.sidebar-overlay.active {
			display: block;
		}

		.shell-main {
			border-radius: 0;
			border-left: none;
			border-right: none;
			box-shadow: none;
		}

		.content-header {
			padding: 0.75rem 1rem;
			padding-left: 3.25rem;
		}

		.main-content > .chats-container {
			padding: 1.25rem 1rem;
		}

		.chat-item {
			padding: 0.875rem 1rem;
		}
	}

	@media (max-width: 480px) {
		.brand-name {
			font-size: 1rem;
		}

		.content-heading h1 {
			font-size: 1.0625rem;
		}
	}
</style>

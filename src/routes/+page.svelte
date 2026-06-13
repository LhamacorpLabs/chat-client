<script lang="ts">
	import { untrack } from 'svelte';
	import { authStore, logout, getValidToken } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import type { Chat } from '$lib/types/chat';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { chatNotifications } from '$lib/stores/chatNotifications';
	import { metadataPollingService } from '$lib/services/metadataPolling';
	import { PUBLIC_CHAT_API_URL } from '$env/static/public';
	import { cleanupAllChatData, schedulePeriodicCleanup } from '$lib/utils/localStorageCleanup';

	let showCreateModal = $state(false);
	let showJoinModal = $state(false);
	let showActionsMenu = $state(false);
	let newChatName = $state('');
	let invitationCode = $state('');
	let showUserMenu = $state(false);
	let isJoining = $state(false);
	let joinError = $state<string | null>(null);
	let selectedChatIndex = $state(-1);
	let backendVersion = $state('');
	let frontendVersion = $state('');

	$effect(() => {
		if (!$authStore.token) {
			clearChats();
			goto('/login');
		}
	});

	$effect(() => {
		chatNotifications.initialize();
		fetchBackendVersion();
		initializeFrontendVersion();

		// Schedule periodic localStorage cleanup
		schedulePeriodicCleanup();
	});

	$effect(() => {
		const hasAuth = !!$authStore.token && !!$authStore.user;
		if (hasAuth) {
			untrack(async () => {
				const token = await getValidToken();
				if (token) {
					await fetchChats(token, false);
				}
			});
		} else {
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
		showActionsMenu = false;
		newChatName = '';
	}

	function closeCreateModal() {
		showCreateModal = false;
		newChatName = '';
	}

	function openChat(chatId: string) {
		goto(`/chat/${chatId}`);
	}

	$effect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Element;

			if (showUserMenu && !target.closest('.user-menu')) {
				showUserMenu = false;
			}

			if (showActionsMenu && !target.closest('.actions-menu')) {
				showActionsMenu = false;
			}
		}

		if (showUserMenu || showActionsMenu) {
			document.addEventListener('click', handleClickOutside);
		}

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

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
		showActionsMenu = false;
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

	function initializeFrontendVersion() {
		try {
			frontendVersion = `fe:${__GIT_COMMIT_ID__}`;
		} catch (error) {
			console.error('Failed to get frontend version:', error);
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
	<div class="chat-app">
		<!-- Header -->
		<header class="app-header">
			<div class="header-content">
				<div class="app-title">
					<img src="/logo.png" alt="Lhama Chat Logo" class="app-logo" />
					<h1>Chat</h1>
				</div>

				<div class="header-actions">
					<ThemeToggle />
					<div class="actions-menu">
						<button
							onclick={() => showActionsMenu = !showActionsMenu}
							class="btn btn-ghost add-btn"
							title="Create or join a chat"
						>+</button>
						{#if showActionsMenu}
							<div class="actions-dropdown">
								<button
									onclick={openCreateModal}
									class="dropdown-item"
								>
									<span>Create</span>
								</button>
								<button
									onclick={openJoinModal}
									class="dropdown-item"
								>
									<span>Join</span>
								</button>
							</div>
						{/if}
					</div>
					<div class="user-menu">
						<button
							onclick={() => showUserMenu = !showUserMenu}
							class="btn btn-ghost user-toggle"
						>
							⋮
						</button>
						{#if showUserMenu}
							<div class="user-dropdown">
								<div class="dropdown-item user-info">
									<span>Logged as @{$authStore.user.username}</span>
								</div>
								<button
									onclick={() => {
										logout();
										showUserMenu = false;
									}}
									class="dropdown-item logout-item"
								>
									<span>Logout</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<!-- Main Content -->
		<main class="main-content">
			<div class="chats-container">
				<div class="chats-header">
					<h2>Your Chats</h2>
				</div>

				<!-- Error Message -->
				{#if $chatStore.error}
					<div class="alert alert-error">
						{$chatStore.error}
					</div>
				{/if}

				<!-- Loading State -->
				{#if $chatStore.isLoading}
					<div class="loading-container">
						<div class="loading-spinner"></div>
						<p>Loading your chats...</p>
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
					<div class="empty-state">
						<div class="empty-icon">💬</div>
						<h3>No chats yet</h3>
						<p>Create your first chat or join one with an invitation code using the "+" button above!</p>
					</div>
				{/if}
			</div>
		</main>

		<!-- Create Chat Modal -->
		{#if showCreateModal}
			<div class="modal-overlay" onclick={closeCreateModal}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Create New Chat</h3>
						<button onclick={closeCreateModal} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p>Enter a name for your new chat:</p>
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
					</div>
				</div>
			</div>
		{/if}

		<!-- Join Chat Modal -->
		{#if showJoinModal}
			<div class="modal-overlay" onclick={closeJoinModal}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Join Chat</h3>
						<button onclick={closeJoinModal} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p>Enter the invitation code to join a chat:</p>
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
					</div>
				</div>
			</div>
		{/if}

		<footer class="app-footer">
			©<span id="year"></span> Lhamacorp <script> document.getElementById('year').textContent = new Date().getFullYear(); </script>
			{#if frontendVersion || backendVersion}
				<span class="version-info">
					{#if frontendVersion} • {frontendVersion}{/if}
					{#if backendVersion} • {backendVersion}{/if}
				</span>
			{/if}
		</footer>
	</div>
{:else}
	<div class="loading-screen">
		<div class="loading-spinner"></div>
		<p>Loading...</p>
	</div>
{/if}

<style>
	.chat-app {
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--bg-primary);
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.app-header {
		background: var(--bg-primary);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.header-content {
		max-width: 720px;
		margin: 0 auto;
		padding: 0.875rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.app-title {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.app-logo {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Actions Menu (+ Button) */
	.actions-menu {
		position: relative;
	}

	.add-btn {
		font-size: 1rem;
		padding: 0.375rem 0.75rem;
		font-weight: 500;
	}

	.actions-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 16px var(--shadow-elevated);
		z-index: 1000;
		min-width: 120px;
		padding: 0.25rem;
	}

	.actions-dropdown .dropdown-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.1s ease;
		font-size: 0.8125rem;
		border-radius: var(--radius-sm);
	}

	.actions-dropdown .dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.actions-dropdown .dropdown-item span {
		display: block;
	}

	/* User Menu */
	.user-menu {
		position: relative;
	}

	.user-toggle {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	.user-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 16px var(--shadow-elevated);
		z-index: 1000;
		min-width: 180px;
		padding: 0.25rem;
	}

	.user-dropdown .dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.1s ease;
		font-size: 0.8125rem;
		border-radius: var(--radius-sm);
	}

	.user-dropdown .dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.user-info {
		cursor: default !important;
		color: var(--text-muted) !important;
		font-size: 0.75rem !important;
		padding-bottom: 0.5rem !important;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid var(--border-color);
		border-radius: 0 !important;
	}

	.user-info:hover {
		background: none !important;
	}

	.logout-item {
		color: var(--danger) !important;
	}

	.logout-item:hover {
		background: rgba(239, 68, 68, 0.08) !important;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
		padding: 2rem 1.5rem;
	}

	/* Footer */
	.app-footer {
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		padding: 0.75rem 1.5rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
		text-align: center;
		flex-shrink: 0;
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.version-info {
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.chats-container {
		max-width: 600px;
		margin: 0 auto;
	}

	.chats-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.chats-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.01em;
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

	.loading-spinner {
		display: inline-block;
		width: 24px;
		height: 24px;
		border: 2px solid var(--border-color);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: spin 0.8s linear infinite;
		margin-bottom: 0.75rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
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
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		transition: all 0.15s ease;
		background: var(--bg-primary);
	}

	.chat-item.clickable {
		cursor: pointer;
		user-select: none;
	}

	.chat-item:hover {
		background: var(--bg-secondary);
		border-color: var(--accent);
	}

	.chat-item.clickable:hover {
		box-shadow: 0 2px 8px var(--shadow-hover);
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

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1.125rem;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	/* Loading Screen */
	.loading-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-muted);
	}

	.loading-screen .loading-spinner {
		width: 28px;
		height: 28px;
		margin-bottom: 0.75rem;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: var(--bg-primary);
		border-radius: var(--radius-xl);
		box-shadow: 0 16px 48px var(--shadow-elevated);
		max-width: 380px;
		width: 90%;
		border: 1px solid var(--border-color);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.25rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all 0.1s ease;
	}

	.close-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-body p {
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

	/* Responsive Design */
	@media (max-width: 768px) {
		.main-content {
			padding: 1.5rem 1rem;
		}

		.header-content {
			padding: 0.75rem 1rem;
		}

		.chats-header {
			margin-bottom: 1rem;
		}

		.chat-item {
			padding: 0.875rem 1rem;
		}

		.header-actions {
			gap: 0.375rem;
		}

		.user-dropdown {
			min-width: 160px;
		}
	}

	@media (max-width: 480px) {
		.app-title {
			gap: 0.5rem;
		}

		.app-logo {
			width: 24px;
			height: 24px;
		}

		.header-content h1 {
			font-size: 1.125rem;
		}

		.empty-state {
			padding: 3rem 1rem;
		}

		.chats-header h2 {
			font-size: 1.125rem;
		}
	}
</style>

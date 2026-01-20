<script lang="ts">
	import { authStore, logout } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import type { Chat } from '$lib/types/chat';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { chatNotifications } from '$lib/stores/chatNotifications';

	let showCreateModal = $state(false);
	let showJoinModal = $state(false);
	let showActionsMenu = $state(false);
	let newChatName = $state('');
	let invitationCode = $state('');
	let showUserMenu = $state(false);
	let isJoining = $state(false);
	let joinError = $state<string | null>(null);

	// Reactive statement: redirect to login when not authenticated
	$effect(() => {
		if (!$authStore.token) {
			clearChats();
			goto('/login');
		}
	});

	// Initialize notification store on app start
	$effect(() => {
		chatNotifications.initialize();
	});

	// Start/stop periodic chat polling based on authentication
	$effect(() => {
		let intervalId: number | null = null;

		if ($authStore.token && $authStore.user) {
			// Fetch chats immediately (show loading for initial load)
			fetchChats($authStore.token, false);

			// Set up silent periodic polling every 10 seconds
			intervalId = window.setInterval(() => {
				if ($authStore.token) {
					fetchChats($authStore.token, true); // Silent mode - no loading indicators
				}
			}, 10000);
		} else {
			// User is not authenticated - clear notifications
			chatNotifications.clear();
		}

		// Cleanup: stop polling when component is destroyed or auth changes
		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
			}
		};
	});

	async function handleCreateChat() {
		if (!$authStore.token || !newChatName.trim()) return;

		const success = await createChat($authStore.token, { name: newChatName.trim() });
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

	// Close menus when clicking outside
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

		isJoining = true;
		joinError = null;

		try {
			await redeemInvitation($authStore.token, { code: invitationCode.trim() });
			await fetchChats($authStore.token);
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
</script>

{#if $authStore.user}
	<div class="chat-app">
		<!-- Header -->
		<header class="app-header">
			<div class="header-content">
				<div class="app-title">
					<img src="/logo.png" alt="Lhama Chat Logo" class="app-logo" />
					<h1>Lhama Chat</h1>
				</div>

				<div class="header-actions">
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
								<div class="dropdown-item theme-item" onclick={() => showUserMenu = false}>
									<span>Theme</span>
									<ThemeToggle />
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
						{#each $chatStore.chats as chat (chat.id)}
							<div class="chat-item card clickable" onclick={() => openChat(chat.id)}>
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
							</div>
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
							<input
								type="text"
								bind:value={newChatName}
								placeholder="Enter chat name..."
								required
								disabled={$chatStore.isCreating}
								class="modal-input"
							/>
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
							<input
								type="text"
								bind:value={invitationCode}
								placeholder="Enter invitation code..."
								required
								disabled={isJoining}
								class="modal-input"
							/>
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
		background: var(--bg-primary);
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.app-header {
		background: var(--bg-primary);
		border-bottom: 2px solid var(--border-light);
		box-shadow: 0 2px 8px var(--shadow);
		flex-shrink: 0;
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.app-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.app-logo {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		background: var(--gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* Actions Menu (+ Button) */
	.actions-menu {
		position: relative;
	}

	.add-btn {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
	}

	.actions-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-light);
		border-radius: 8px;
		box-shadow: 0 4px 12px var(--shadow);
		z-index: 1000;
		min-width: 100px;
		margin-top: 0.5rem;
	}

	.actions-dropdown .dropdown-item {
		display: block;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.2s ease;
		font-size: 0.9rem;
	}

	.actions-dropdown .dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.actions-dropdown .dropdown-item:first-child {
		border-top-left-radius: 8px;
		border-top-right-radius: 8px;
	}

	.actions-dropdown .dropdown-item:last-child {
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
	}

	.actions-dropdown .dropdown-item span {
		display: block;
	}


	/* User Menu */
	.user-menu {
		position: relative;
	}

	.user-toggle {
		font-size: 1.2rem;
		padding: 0.5rem 0.75rem;
		font-weight: bold;
		line-height: 1;
	}

	.user-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-light);
		border-radius: 8px;
		box-shadow: 0 4px 12px var(--shadow);
		z-index: 1000;
		min-width: 180px;
		margin-top: 0.5rem;
	}

	.user-dropdown .dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.2s ease;
		font-size: 0.9rem;
	}

	.user-dropdown .dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.user-info {
		cursor: default !important;
		color: var(--text-secondary) !important;
		font-size: 0.85rem !important;
		border-bottom: 1px solid var(--border-light);
		margin-bottom: 0;
	}

	.user-info:hover {
		background: none !important;
	}

	.user-dropdown .dropdown-item:first-child {
		border-top-left-radius: 8px;
		border-top-right-radius: 8px;
	}

	.user-dropdown .dropdown-item:last-child {
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
	}

	.logout-item {
		color: var(--danger);
		border-top: 1px solid var(--border-light);
	}

	.logout-item:hover {
		background: var(--danger);
		color: white;
	}

	.theme-item {
		justify-content: space-between;
		align-items: center;
	}

	/* Ensure theme toggle doesn't inherit hover styles from dropdown item */
	.theme-item:hover :global(.theme-toggle) {
		transform: none;
	}

	.theme-item :global(.theme-toggle) {
		flex-shrink: 0;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		padding: 2rem;
	}

	.chats-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.chats-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.chats-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.8rem;
		font-weight: 700;
	}




	/* Loading Container */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.loading-spinner {
		display: inline-block;
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Chat List */
	.chats-list {
		display: grid;
		gap: 1rem;
	}

	.chat-item {
		padding: 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 2px solid var(--border-light);
		transition: all 0.2s ease;
	}

	.chat-item.clickable {
		cursor: pointer;
		user-select: none;
	}

	.chat-item:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.chat-item.clickable:hover {
		box-shadow: 0 4px 12px var(--shadow);
	}

	.chat-info {
		flex: 1;
	}

	.chat-name-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.chat-name {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 600;
	}

	.unread-indicator {
		width: 8px;
		height: 8px;
		background: var(--accent);
		border-radius: 50%;
		flex-shrink: 0;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	.chat-meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.chat-chevron {
		color: var(--text-muted);
		font-size: 1.5rem;
		font-weight: bold;
		opacity: 0.6;
		transition: all 0.2s ease;
	}

	.chat-item.clickable:hover .chat-chevron {
		color: var(--accent);
		opacity: 1;
		transform: translateX(3px);
	}


	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1.4rem;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0 0 2rem 0;
		font-size: 1rem;
	}


	/* Loading Screen */
	.loading-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.loading-screen .loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
		margin-bottom: 1rem;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: var(--bg-primary);
		border-radius: 12px;
		box-shadow: 0 8px 32px var(--shadow);
		max-width: 400px;
		width: 90%;
		border: 1px solid var(--border-light);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-light);
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 700;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
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
	}

	.modal-input {
		width: 100%;
		margin-bottom: 1rem;
	}

	.modal-error {
		margin-bottom: 1rem;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.modal-actions button {
		min-width: 100px;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.main-content {
			padding: 1rem;
		}

		.header-content {
			padding: 1rem;
		}

		.chats-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.chats-header h2 {
			text-align: center;
		}

		.chat-item {
			padding: 1rem;
		}

		.chat-name {
			font-size: 1.1rem;
		}

		.chat-meta {
			font-size: 0.8rem;
		}



		.header-actions {
			gap: 0.75rem;
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
			width: 28px;
			height: 28px;
		}

		.header-content h1 {
			font-size: 1.3rem;
		}

		.empty-state {
			padding: 2rem 1rem;
		}

		.empty-icon {
			font-size: 3rem;
		}

		.chats-header h2 {
			font-size: 1.5rem;
		}
	}
</style>

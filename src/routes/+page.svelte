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
					<DropdownMenu width="180px">
						{#snippet trigger({ toggle })}
							<button
								onclick={toggle}
								class="btn btn-ghost user-toggle"
								type="button"
							>
								⋮
							</button>
						{/snippet}
						{#snippet children({ close })}
							<div class="dropdown-item user-info">
								<span>Logged as @{$authStore.user?.username}</span>
							</div>
							<button
								onclick={() => {
									logout();
									close();
								}}
								class="dropdown-item danger"
								type="button"
							>
								<span>Logout</span>
							</button>
						{/snippet}
					</DropdownMenu>
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
	</div>
{:else}
	<div class="loading-screen">
		<LoadingSpinner size="lg" label="Loading..." />
	</div>
{/if}

<style>
	.chat-app {
		height: 100vh;
		height: 100dvh;
		background: var(--bg-primary);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Header */
	.app-header {
		background: var(--bg-primary);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	:global([data-theme='dark']) .app-header {
		background: var(--bg-glass);
		backdrop-filter: blur(var(--glass-blur));
		-webkit-backdrop-filter: blur(var(--glass-blur));
		border-bottom-color: var(--glass-border);
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

	/* Actions Menu (+ Button) and User Menu are now handled by the shared
	   DropdownMenu component (src/lib/components/ui/DropdownMenu.svelte). */
	.add-btn {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	.user-toggle {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	:global(.user-info) {
		cursor: default !important;
		color: var(--text-muted) !important;
		font-size: var(--font-xs) !important;
		padding-bottom: var(--space-2) !important;
		margin-bottom: var(--space-1);
		border-bottom: 1px solid var(--border-color);
		border-radius: 0 !important;
	}

	:global(.user-info:hover) {
		background: none !important;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
		padding: 2rem 1.5rem;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
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

	:global([data-theme='dark']) .app-footer {
		background: transparent;
		border-top-color: var(--glass-border);
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
		transition: all 0.2s ease;
		background: var(--bg-primary);
	}

	:global([data-theme='dark']) .chat-item {
		background: var(--bg-glass);
		border-color: var(--glass-border);
		backdrop-filter: blur(var(--glass-blur));
		-webkit-backdrop-filter: blur(var(--glass-blur));
	}

	:global([data-theme='dark']) .chat-item:hover {
		background: var(--bg-glass-hover);
		border-color: var(--accent);
		box-shadow: 0 0 16px var(--accent-subtle), 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	:global([data-theme='dark']) .chat-item.selected {
		border-color: var(--accent);
		background: var(--accent-subtle);
		box-shadow: 0 0 20px var(--accent-subtle);
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

	:global([data-theme='dark']) .unread-indicator {
		box-shadow: 0 0 8px rgba(129, 140, 248, 0.4);
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
		background: var(--bg-primary);
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

		.chats-header h2 {
			font-size: 1.125rem;
		}
	}
</style>

<script lang="ts">
	import { authStore, logout } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import type { Chat } from '$lib/types/chat';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let showCreateForm = $state(false);
	let showJoinForm = $state(false);
	let newChatName = $state('');
	let invitationCode = $state('');
	let isJoining = $state(false);
	let joinError = $state<string | null>(null);

	// Reactive statement: redirect to login when not authenticated
	$effect(() => {
		if (!$authStore.token) {
			clearChats();
			goto('/login');
		}
	});

	// Fetch chats when user is authenticated
	$effect(() => {
		if ($authStore.token && $authStore.user) {
			fetchChats($authStore.token);
		}
	});

	async function handleCreateChat() {
		if (!$authStore.token || !newChatName.trim()) return;

		const success = await createChat($authStore.token, { name: newChatName.trim() });
		if (success) {
			newChatName = '';
			showCreateForm = false;
		}
	}

	function handleCancelCreate() {
		newChatName = '';
		showCreateForm = false;
	}

	function openChat(chatId: string) {
		goto(`/chat/${chatId}`);
	}

	async function handleJoinChat() {
		if (!$authStore.token || !invitationCode.trim()) return;

		isJoining = true;
		joinError = null;

		try {
			await redeemInvitation($authStore.token, { code: invitationCode.trim() });
			// Success - refresh chats to include the new joined chat
			await fetchChats($authStore.token);
			invitationCode = '';
			showJoinForm = false;
		} catch (err) {
			joinError = err instanceof Error ? err.message : 'Failed to join chat';
		} finally {
			isJoining = false;
		}
	}

	function handleCancelJoin() {
		invitationCode = '';
		showJoinForm = false;
		joinError = null;
	}
</script>

{#if $authStore.user}
	<div class="chat-app">
		<!-- Header -->
		<header class="app-header">
			<div class="header-content">
				<h1>🦙 Lhama Chat</h1>

				<div class="header-actions">
					<span class="username">@{$authStore.user.username}</span>
					<ThemeToggle />
					<button onclick={logout} class="btn btn-danger">Logout</button>
				</div>
			</div>
		</header>

		<!-- Main Content -->
		<main class="main-content">
			<div class="chats-container">
				<div class="chats-header">
					<h2>Your Chats</h2>
					{#if !showCreateForm && !showJoinForm}
						<div class="header-buttons">
							<button onclick={() => showCreateForm = true} class="btn btn-primary">
								+ New Chat
							</button>
							<button onclick={() => showJoinForm = true} class="btn btn-ghost">
								Join Chat
							</button>
						</div>
					{/if}
				</div>

				<!-- Create Chat Form -->
				{#if showCreateForm}
					<div class="create-chat-form card">
						<h3>Create New Chat</h3>
						<form onsubmit={(e) => { e.preventDefault(); handleCreateChat(); }}>
							<input
								type="text"
								bind:value={newChatName}
								placeholder="Enter chat name..."
								required
								disabled={$chatStore.isCreating}
							/>
							<div class="form-actions">
								<button
									type="submit"
									class="btn btn-primary"
									disabled={$chatStore.isCreating || !newChatName.trim()}
								>
									{$chatStore.isCreating ? 'Creating...' : 'Create Chat'}
								</button>
								<button
									type="button"
									onclick={handleCancelCreate}
									class="btn btn-ghost"
									disabled={$chatStore.isCreating}
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Join Chat Form -->
				{#if showJoinForm}
					<div class="join-chat-form card">
						<h3>Join Chat with Invitation</h3>
						<form onsubmit={(e) => { e.preventDefault(); handleJoinChat(); }}>
							<input
								type="text"
								bind:value={invitationCode}
								placeholder="Enter invitation code..."
								required
								disabled={isJoining}
							/>
							<div class="form-actions">
								<button
									type="submit"
									class="btn btn-primary"
									disabled={isJoining || !invitationCode.trim()}
								>
									{isJoining ? 'Joining...' : 'Join Chat'}
								</button>
								<button
									type="button"
									onclick={handleCancelJoin}
									class="btn btn-ghost"
									disabled={isJoining}
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Join Error Message -->
				{#if joinError}
					<div class="alert alert-error">
						{joinError}
					</div>
				{/if}

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
							<div class="chat-item card">
								<div class="chat-info">
									<h3 class="chat-name">#{chat.name}</h3>
									<p class="chat-meta">
										Created {new Date(chat.createdAt).toLocaleDateString()}
										{#if chat.members.length > 0}
											• {chat.members.length} member{chat.members.length === 1 ? '' : 's'}
										{/if}
									</p>
								</div>
								<div class="chat-actions">
									<button onclick={() => openChat(chat.id)} class="btn btn-primary">
										Open Chat
									</button>
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
						<p>Create your first chat or join one with an invitation code!</p>
						{#if !showCreateForm && !showJoinForm}
							<div class="empty-actions">
								<button onclick={() => showCreateForm = true} class="btn btn-primary">
									Create Your First Chat
								</button>
								<button onclick={() => showJoinForm = true} class="btn btn-ghost">
									Join with Code
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</main>
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

	.username {
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.9rem;
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

	.header-buttons {
		display: flex;
		gap: 1rem;
	}

	/* Create Chat Form */
	.create-chat-form {
		margin-bottom: 2rem;
		padding: 1.5rem;
	}

	.create-chat-form h3 {
		margin: 0 0 1rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 600;
	}

	.create-chat-form input {
		margin-bottom: 1rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
	}

	.form-actions button {
		flex: none;
	}

	/* Join Chat Form */
	.join-chat-form {
		margin-bottom: 2rem;
		padding: 1.5rem;
	}

	.join-chat-form h3 {
		margin: 0 0 1rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 600;
	}

	.join-chat-form input {
		margin-bottom: 1rem;
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

	.chat-item:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.chat-info {
		flex: 1;
	}

	.chat-name {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 600;
	}

	.chat-meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.chat-actions {
		flex-shrink: 0;
		margin-left: 1rem;
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

	.empty-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
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
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.chat-actions {
			margin-left: 0;
			width: 100%;
		}

		.chat-actions button {
			width: 100%;
		}

		.form-actions {
			flex-direction: column;
		}

		.header-buttons {
			flex-direction: column;
			gap: 0.5rem;
		}

		.empty-actions {
			flex-direction: column;
		}

		.header-actions {
			gap: 0.75rem;
		}

		.username {
			display: none;
		}
	}

	@media (max-width: 480px) {
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

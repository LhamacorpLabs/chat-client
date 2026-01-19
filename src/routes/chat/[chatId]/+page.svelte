<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { fetchMessages, sendMessage, createInvitation } from '$lib/api/chat';
	import type { Message, Chat } from '$lib/types/chat';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	interface PageData {
		chatId: string;
		chat: Chat;
		isOwner: boolean;
	}

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let messages: Message[] = $state([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Message sending state
	let newMessage = $state('');
	let isSending = $state(false);
	let sendError = $state<string | null>(null);

	// Invitation state
	let showInviteModal = $state(false);
	let inviteCode = $state<string | null>(null);
	let isCreatingInvite = $state(false);
	let inviteError = $state<string | null>(null);

	// Message polling state
	let pollingInterval: NodeJS.Timeout | null = null;

	// Use data from the page loader
	const chatId = data.chatId;
	const currentChat = data.chat;
	const chatName = currentChat.name;
	const isOwner = data.isOwner;

	// Fetch messages when page loads and user is authenticated
	$effect(() => {
		if ($authStore.token && chatId) {
			loadMessages();
		}
	});

	// Start/stop message polling based on auth and loading state
	$effect(() => {
		if ($authStore.token && chatId && !isLoading && messages.length >= 0) {
			startMessagePolling();
		} else {
			stopMessagePolling();
		}

		// Cleanup on component destroy
		return () => {
			stopMessagePolling();
		};
	});

	async function loadMessages() {
		if (!$authStore.token) return;

		isLoading = true;
		error = null;

		try {
			const fetchedMessages = await fetchMessages($authStore.token, chatId);
			messages = fetchedMessages;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load messages';
		} finally {
			isLoading = false;
		}
	}

	async function pollForMessages() {
		if (!$authStore.token || isLoading) return;

		try {
			const fetchedMessages = await fetchMessages($authStore.token, chatId);

			// Only update if we have new messages (compare by length and last message id)
			if (fetchedMessages.length > messages.length ||
				(fetchedMessages.length > 0 && messages.length > 0 &&
				 fetchedMessages[fetchedMessages.length - 1].id !== messages[messages.length - 1]?.id)) {
				messages = fetchedMessages;
			}
		} catch (err) {
			// Silently handle polling errors to avoid UI disruption
			console.error('Message polling error:', err);
		}
	}

	function startMessagePolling() {
		if (pollingInterval) return; // Already polling

		pollingInterval = setInterval(pollForMessages, 1000); // Poll every second
	}

	function stopMessagePolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	function goBack() {
		stopMessagePolling();
		goto('/');
	}

	async function handleSendMessage() {
		if (!$authStore.token || !newMessage.trim()) return;

		const messageText = newMessage.trim();
		newMessage = ''; // Clear input immediately
		sendError = null;
		isSending = true;

		// Temporarily stop polling while sending
		stopMessagePolling();

		try {
			const sentMessage = await sendMessage($authStore.token, chatId, { message: messageText });
			// Add the new message to the messages array
			messages = [...messages, sentMessage];
		} catch (err) {
			sendError = err instanceof Error ? err.message : 'Failed to send message';
			// Restore the message text if sending failed
			newMessage = messageText;
		} finally {
			isSending = false;
			// Restart polling after sending
			if ($authStore.token && chatId) {
				startMessagePolling();
			}
		}
	}

	function handleMessageSubmit(e: Event) {
		e.preventDefault();
		handleSendMessage();
	}

	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	async function handleCreateInvite() {
		if (!$authStore.token) return;

		isCreatingInvite = true;
		inviteError = null;
		inviteCode = null;

		try {
			const invitation = await createInvitation($authStore.token, chatId);
			inviteCode = invitation.code;
			showInviteModal = true;
		} catch (err) {
			inviteError = err instanceof Error ? err.message : 'Failed to create invitation';
		} finally {
			isCreatingInvite = false;
		}
	}

	function closeInviteModal() {
		showInviteModal = false;
		inviteCode = null;
		inviteError = null;
	}

	function copyInviteCode() {
		if (inviteCode) {
			navigator.clipboard.writeText(inviteCode);
		}
	}

	function getUsernameFromId(userId: string): string {
		if (userId === $authStore.user?.id) {
			return 'You';
		}

		const member = currentChat.members.find(member => member.id === userId);
		return member ? member.name : `User ${userId}`;
	}
</script>

{#if $authStore.user}
	<div class="chat-page">
		<!-- Header -->
		<header class="chat-header">
			<div class="header-content">
				<div class="header-left">
					<button onclick={goBack} class="btn btn-ghost back-btn">
						← Back to Chats
					</button>
					<div class="chat-title">
						<img src="/logo.png" alt="Lhama Chat Logo" class="chat-logo" />
						<h1>#{chatName}</h1>
					</div>
				</div>

				<div class="header-actions">
					{#if isOwner}
						<button
							onclick={handleCreateInvite}
							class="btn btn-ghost invite-btn"
							disabled={isCreatingInvite}
						>
							{isCreatingInvite ? 'Creating...' : '+ Invite'}
						</button>
					{/if}
					<span class="username">@{$authStore.user.username}</span>
					<ThemeToggle />
				</div>
			</div>
		</header>

		<!-- Main Chat Area -->
		<main class="chat-content">
			{#if error}
				<div class="error-container">
					<div class="alert alert-error">
						{error}
					</div>
					<button onclick={loadMessages} class="btn btn-primary">
						Try Again
					</button>
				</div>
			{:else if isLoading}
				<div class="loading-container">
					<div class="loading-spinner"></div>
					<p>Loading messages...</p>
				</div>
			{:else if messages.length === 0}
				<div class="empty-messages">
					<div class="empty-icon">💬</div>
					<h3>No messages yet</h3>
					<p>Be the first to start the conversation!</p>
				</div>
			{:else}
				<div class="messages-container">
					{#each messages as message (message.id)}
						{@const isOwnMessage = message.userId === $authStore.user?.id}
						<div class="message-item {isOwnMessage ? 'own-message' : 'other-message'}">
							<div class="message-header">
								<span class="message-user">
									{getUsernameFromId(message.userId)}
								</span>
								<span class="message-time">
									{new Date(message.createdAt).toLocaleString()}
								</span>
							</div>
							<div class="message-content">
								{message.message}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</main>

		<!-- Message Input -->
		<footer class="message-input-area">
			{#if sendError}
				<div class="send-error alert alert-error">
					{sendError}
				</div>
			{/if}

			<form onsubmit={handleMessageSubmit} class="input-container">
				<input
					type="text"
					bind:value={newMessage}
					onkeydown={handleKeyPress}
					placeholder="Type a message..."
					disabled={isSending}
					class="message-input"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isSending || !newMessage.trim()}
				>
					{isSending ? 'Sending...' : 'Send'}
				</button>
			</form>
		</footer>

		<!-- Invitation Modal -->
		{#if showInviteModal && inviteCode}
			<div class="modal-overlay" onclick={closeInviteModal}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Invitation Created!</h3>
						<button onclick={closeInviteModal} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p>Share this invitation code with others to join the chat:</p>
						<div class="invite-code-display">
							<span class="invite-code">{inviteCode}</span>
							<button onclick={copyInviteCode} class="btn btn-ghost copy-btn">
								Copy
							</button>
						</div>
						<p class="invite-note">This code can be used once to join the chat.</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Invitation Error -->
		{#if inviteError}
			<div class="error-toast alert alert-error">
				{inviteError}
				<button onclick={() => inviteError = null} class="close-btn">&times;</button>
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
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-primary);
	}

	/* Header */
	.chat-header {
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

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.chat-logo {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.back-btn {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-primary);
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

	/* Chat Content */
	.chat-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
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

	.empty-messages {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.empty-messages h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1.4rem;
		font-weight: 600;
	}

	.empty-messages p {
		margin: 0;
		font-size: 1rem;
	}

	/* Messages */
	.messages-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0;
	}

	.message-item {
		border-radius: 12px;
		padding: 1rem;
		max-width: 70%;
		margin-bottom: 0.5rem;
		transition: all 0.2s ease;
		animation: fadeInMessage 0.3s ease-out;
	}

	@keyframes fadeInMessage {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.own-message {
		background: var(--accent);
		color: white;
		border: 1px solid var(--accent);
		align-self: flex-end;
		border-bottom-right-radius: 4px;
	}

	.other-message {
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		align-self: flex-start;
		border-bottom-left-radius: 4px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		gap: 1rem;
	}

	.message-user {
		font-weight: 600;
		color: var(--accent);
		font-size: 0.9rem;
	}

	.message-time {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.message-content {
		color: var(--text-primary);
		line-height: 1.5;
		word-wrap: break-word;
	}

	/* Own message styling overrides */
	.own-message .message-user {
		color: rgba(255, 255, 255, 0.9);
	}

	.own-message .message-time {
		color: rgba(255, 255, 255, 0.7);
	}

	.own-message .message-content {
		color: white;
	}

	/* Message Input */
	.message-input-area {
		background: var(--bg-primary);
		border-top: 2px solid var(--border-light);
		padding: 1rem;
		flex-shrink: 0;
	}

	.send-error {
		max-width: 1200px;
		margin: 0 auto 1rem auto;
	}

	.input-container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.message-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border-radius: 25px;
		border: 2px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		.header-content {
			padding: 1rem;
		}

		.header-left {
			gap: 0.5rem;
		}

		.back-btn {
			padding: 0.5rem;
			font-size: 0.8rem;
		}

		.chat-title {
			gap: 0.25rem;
		}

		.chat-logo {
			width: 20px;
			height: 20px;
		}

		.header-content h1 {
			font-size: 1.2rem;
		}

		.message-item {
			max-width: 85%;
		}

		.message-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.username {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.chat-content {
			padding: 0.5rem;
		}

		.message-input-area {
			padding: 0.75rem;
		}

		.input-container {
			gap: 0.5rem;
		}

		.message-item {
			max-width: 95%;
			padding: 0.75rem;
		}

		/* Better mobile positioning for messages */
		.own-message {
			margin-left: 5%;
		}

		.other-message {
			margin-right: 5%;
		}
	}

	/* Invitation Button */
	.invite-btn {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
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

	.invite-code-display {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 1rem 0;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px solid var(--border-light);
	}

	.invite-code {
		flex: 1;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--accent);
		text-align: center;
		letter-spacing: 1px;
	}

	.copy-btn {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.invite-note {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Error Toast */
	.error-toast {
		position: fixed;
		top: 2rem;
		right: 2rem;
		z-index: 1001;
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 300px;
		box-shadow: 0 4px 12px var(--shadow);
	}

	.error-toast .close-btn {
		margin-left: auto;
	}
</style>
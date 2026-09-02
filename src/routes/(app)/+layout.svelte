<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { authStore, authLoaded, logout, getValidToken } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import type { Chat } from '$lib/types/chat';
	import { goto } from '$app/navigation';
	import { chatNotifications } from '$lib/stores/chatNotifications';
	import { metadataPollingService } from '$lib/services/metadataPolling';
	import { PUBLIC_CHAT_API_URL } from '$env/static/public';
	import { cleanupAllChatData, schedulePeriodicCleanup } from '$lib/utils/localStorageCleanup';
	import Modal from '$lib/components/ui/Modal.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Rail from '$lib/components/Rail.svelte';

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

	// Whether the rail is expanded into the full chat list (desktop only -
	// on mobile, visibility is still driven purely by the route, see
	// isChatRoute below). This is a user preference, not transient UI
	// state: it's driven solely by the rail's own toggle button and
	// persisted to localStorage, so it stays how the user left it across
	// selecting a chat, clicking into the conversation, and reloads -
	// nothing else here collapses or expands it automatically.
	let listOpen = $state(
		typeof window === 'undefined' || localStorage.getItem('chatListOpen') !== 'false'
	);

	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('chatListOpen', String(listOpen));
		}
	});

	// The currently open chat, if any - drives both the mobile show/hide
	// (list vs. conversation) and highlighting the open chat in the list.
	let openChatId = $derived(page.params.chatId as string | undefined);
	let isChatRoute = $derived(!!openChatId);

	// On mobile there's no room for an icon-only rail, and the merged
	// rail+list has no separate flyout to fall back on - so the rail is
	// always rendered expanded there (full list, full width), visibility
	// driven purely by isChatRoute via CSS instead of the listOpen toggle.
	let isMobile = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
	);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mql = window.matchMedia('(max-width: 768px)');
		function update() {
			isMobile = mql.matches;
		}
		mql.addEventListener('change', update);
		return () => mql.removeEventListener('change', update);
	});

	let effectiveListOpen = $derived(isMobile || listOpen);

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

			// Ignore key combos (e.g. Ctrl+C to copy a selected message) so they
			// aren't swallowed by the single-letter shortcuts below.
			if (event.ctrlKey || event.metaKey || event.altKey) {
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
					if (isChatRoute) break;
					event.preventDefault();
					openCreateModal();
					break;
				case 'j':
					if (isChatRoute) break;
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
	<div class="app-shell" class:chat-open={isChatRoute}>
		<!-- Rail is a direct app-shell child (not inset by --gap like the
		     rest of the chrome) so it spans the full window height, flush
		     against the top/bottom/left edges - matching the reference's
		     edge-to-edge nav rail. It IS the chat list now too (expanded
		     in place, no separate flyout panel) - see Rail.svelte. -->
		<div class="rail-wrapper">
			<Rail
				chats={$chatStore.chats}
				activeChatId={openChatId}
				unreadMap={$chatNotifications.hasUnreadMessages}
				isLoading={$chatStore.isLoading}
				error={$chatStore.error}
				{selectedChatIndex}
				expanded={effectiveListOpen}
				onToggleExpanded={() => (listOpen = !listOpen)}
				onSelectChat={openChat}
				onOpenCreateModal={openCreateModal}
				onOpenJoinModal={openJoinModal}
				onLogout={() => logout()}
			/>
		</div>

		<div class="app-content">
		<div class="shell-row">

		<!-- Main column - the active route renders here. On desktop this
		     sits beside the rail at all times; on mobile it only takes
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
		</div>

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
		overflow: hidden;
	}

	/* Everything except the rail keeps the old inset/floating-panel
	   treatment - only the rail itself is edge-to-edge. */
	.app-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		gap: var(--gap);
		padding: var(--gap);
		padding-bottom: 0;
	}

	/* Just the main column now - the rail (including the expanded chat
	   list) lives entirely in Rail.svelte, not here. */
	.shell-row {
		flex: 1;
		min-height: 0;
		display: flex;
	}

	.rail-wrapper {
		display: contents;
	}

	/* Main column - just a sizing container. The active route (the "select
	   a chat" placeholder, or the chat view) provides its own floating
	   panel look, same as the rail, so this stays unstyled. */
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
		.app-content {
			gap: 0;
			padding: 0;
		}

		.shell-row {
			gap: 0;
		}

		/* No icon-only state on mobile - there's no separate flyout to
		   fall back on now that the rail and list are merged, so the
		   rail is always rendered expanded (full list, full width - see
		   Rail.svelte's own mobile media query for the width override)
		   and visibility is driven by isChatRoute instead, WhatsApp-style:
		   the list or the open chat, never both. */
		.shell-main {
			display: none;
		}

		.app-footer {
			display: none;
		}

		.app-shell.chat-open :global(.rail) {
			display: none;
		}

		.app-shell.chat-open .shell-main {
			display: flex;
			width: 100%;
		}
	}

</style>

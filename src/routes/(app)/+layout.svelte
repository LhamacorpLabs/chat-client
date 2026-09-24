<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { authStore, authLoaded, logout, getValidToken } from '$lib/stores/auth';
	import { chatStore, fetchChats, createChat, clearChats } from '$lib/stores/chat';
	import { redeemInvitation } from '$lib/api/chat';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { chatNotifications } from '$lib/stores/chatNotifications';
	import { metadataPollingService } from '$lib/services/metadataPolling';
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
			goto(resolve('/login'));
		}
	});

	$effect(() => {
		chatNotifications.initialize();
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
		goto(resolve('/(app)/chat/[chatId]', { chatId }));
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
		<!-- The rail spans the full window height and IS the chat list
		     (expanded in place, or collapsed to an avatar stack) - see
		     Rail.svelte. -->
		<div class="rail-wrapper">
			<Rail
				chats={$chatStore.chats}
				activeChatId={openChatId}
				unreadMap={$chatNotifications.hasUnreadMessages}
				isLoading={$chatStore.isLoading}
				error={$chatStore.error}
				{selectedChatIndex}
				expanded={effectiveListOpen}
				{appVersion}
				showDownload={!isElectron}
				onToggleExpanded={() => (listOpen = !listOpen)}
				onSelectChat={openChat}
				onOpenCreateModal={openCreateModal}
				onOpenJoinModal={openJoinModal}
				onLogout={() => logout()}
			/>
		</div>

		<!-- Main column - the active route renders here. On desktop this
		     sits beside the rail at all times; on mobile it only takes
		     over the full screen while a chat is open (WhatsApp's mobile
		     behavior), and the list route never shows it. Copyright,
		     version and the download link live in the rail's account menu. -->
		<div class="shell-main">
			{@render children()}
		</div>

		<!-- Create Chat Modal -->
		{#if showCreateModal}
			<Modal title="Create a chat" description="Give it a short, recognizable name." onClose={closeCreateModal}>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateChat(); }}>
					{#key showCreateModal}
					<label class="field-label" for="new-chat-name">Name</label>
					<div class="prefixed-input">
					<span class="input-prefix" aria-hidden="true">#</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="new-chat-name"
						type="text"
						bind:value={newChatName}
						placeholder="e.g. design-review"
						required
						disabled={$chatStore.isCreating}
						class="modal-input"
						autocomplete="off"
						autofocus
					/>
					</div>
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
							{$chatStore.isCreating ? 'Creating…' : 'Create chat'}
						</button>
					</div>
				</form>
			</Modal>
		{/if}

		<!-- Join Chat Modal -->
		{#if showJoinModal}
			<Modal title="Join a chat" description="Paste the invitation code someone shared with you." onClose={closeJoinModal}>
				<form onsubmit={(e) => { e.preventDefault(); handleJoinChat(); }}>
					{#key showJoinModal}
					<label class="field-label" for="invite-code">Invitation code</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="invite-code"
						type="text"
						bind:value={invitationCode}
						placeholder="Paste code"
						required
						disabled={isJoining}
						class="modal-input code-input"
						autocomplete="off"
						spellcheck="false"
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
							{isJoining ? 'Joining…' : 'Join chat'}
						</button>
					</div>
				</form>
			</Modal>
		{/if}
	</div>
{:else}
	<div class="loading-screen">
		<LoadingSpinner size="lg" />
	</div>
{/if}

<style>
	.app-shell {
		height: 100vh;
		height: 100dvh;
		display: flex;
		overflow: hidden;
		background: var(--app-bg);
	}

	.rail-wrapper {
		display: contents;
	}

	/* Main column - just a sizing container; the active route (the
	   welcome screen, or the chat view) fills it. */
	.shell-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
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

	/* Modal chrome lives in the shared Modal component - the rules below
	   only style the form content this page passes into the modal's body. */
	.field-label {
		display: block;
		margin-bottom: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 550;
		color: var(--text-secondary);
	}

	.prefixed-input {
		position: relative;
	}

	.input-prefix {
		position: absolute;
		left: 0.875rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.prefixed-input .modal-input {
		padding-left: 1.75rem;
	}

	.modal-input {
		width: 100%;
		height: 2.5rem;
	}

	.code-input {
		font-family: var(--font-mono);
		letter-spacing: 0.06em;
	}

	.modal-error {
		margin: 0.75rem 0 0;
	}

	.modal-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	/* Responsive Design - on mobile the shell only ever shows one pane at a
	   time, WhatsApp-style: the chat list by default, or the open chat
	   (full-screen) while chat-open is set. The rail is always rendered
	   expanded there (see isMobile above and Rail.svelte's media query). */
	@media (max-width: 768px) {
		.shell-main {
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

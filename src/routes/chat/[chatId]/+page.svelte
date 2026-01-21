<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { chatStore, deleteChat } from '$lib/stores/chat';
	import { fetchMessages, fetchMessagesPaginated, sendMessage, createInvitation, fetchChats as apiFetchChats, deleteMessage, leaveChat, uploadImage } from '$lib/api/chat';
	import type { Message, Chat, PagedMessageResponse } from '$lib/types/chat';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import ParsedMessage from '$lib/components/ParsedMessage.svelte';
	import { hasImages } from '$lib/utils/imageMessages';
	import {
		memberColorsStore,
		assignColorsForChat,
		addMemberColor,
		getMemberColor,
		shouldUseMemberColors,
		loadMemberColors
	} from '$lib/stores/memberColors';
	import { linkify, type LinkifyResult } from '$lib/utils/linkify';
	import LinkPreview from '$lib/components/LinkPreview.svelte';
	import { chatNotifications } from '$lib/stores/chatNotifications';
	import { playNotificationSound, isWindowFocused } from '$lib/utils/notificationSound';
	import { showMessageNotification } from '$lib/utils/osNotification';
	import { chatMuteStore } from '$lib/stores/chatMute';

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

	// Image upload state
	let selectedImages = $state<File[]>([]);
	let isUploadingImages = $state(false);
	let showImageUpload = $state(false);

	// Invitation state
	let showInviteModal = $state(false);
	let inviteCode = $state<string | null>(null);
	let isCreatingInvite = $state(false);
	let inviteError = $state<string | null>(null);

	// Delete state
	let showDeleteModal = $state(false);
	let showLeaveModal = $state(false);
	let isLeaving = $state(false);
	let showActionsMenu = $state(false);
	let openActionMenuId = $state<string | null>(null);

	// Link confirmation state
	let showLinkConfirmation = $state(false);
	let pendingUrl = $state<string | null>(null);

	// Message polling state
	let pollingInterval: NodeJS.Timeout | null = null;
	let messageInputElement: HTMLInputElement;
	let chatContent: HTMLElement;
	let windowFocused = $state(true);
	let hasUnreadMessages = $state(false);

	// Pagination state
	let nextCursor = $state<string | null>(null);
	let prevCursor = $state<string | null>(null);
	let hasMoreMessages = $state(false);
	let isLoadingMore = $state(false);

	// Scroll behavior state
	let shouldAutoScroll = $state(true);
	let showJumpToNewest = $state(false);
	let isUserScrolling = $state(false);
	let isInitialScroll = $state(true); // Flag to prevent auto-scroll during initial intelligent scrolling

	// Member colors state
	let shouldUseColors = $state(false);

	const chatId = data.chatId;
	const currentChat = data.chat;
	const chatName = currentChat.name;
	const isOwner = data.isOwner;
	$effect(() => {
		if ($authStore.token && chatId) {
			// Load member colors from localStorage on first load
			loadMemberColors();

			// Determine if we should use colors for this chat
			shouldUseColors = shouldUseMemberColors(currentChat.members);

			// Assign colors to members (if applicable)
			if (shouldUseColors) {
				assignColorsForChat(chatId, currentChat.members);
			}

			// Load messages
			loadMessages();
		}
	});

	$effect(() => {
		if (messageInputElement && !isSending) {
			messageInputElement.focus();
		}
	});

	function scrollToBottom() {
		if (chatContent) {
			setTimeout(() => {
				chatContent.scrollTop = chatContent.scrollHeight;
			}, 0);
		}
	}

	function scrollToMessage(messageIndex: number) {
		if (chatContent && messageIndex >= 0 && messageIndex < messages.length) {
			setTimeout(() => {
				// Find the message element by index
				const messageElements = chatContent.querySelectorAll('.message-item');
				if (messageElements[messageIndex]) {
					messageElements[messageIndex].scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});
				}
			}, 100); // Give DOM time to update
		}
	}

	// Smart auto-scroll: only scroll to bottom when appropriate
	$effect(() => {
		if (messages.length > 0 && shouldAutoScroll && !isUserScrolling && !isInitialScroll) {
			scrollToBottom();
		}
	});

	// Infinite scroll detection and jump button visibility
	$effect(() => {
		if (!chatContent) return;

		function handleScroll() {
			if (!chatContent) return;

			const scrollTop = chatContent.scrollTop;
			const scrollHeight = chatContent.scrollHeight;
			const clientHeight = chatContent.clientHeight;

			// Check if user is near the bottom (within 200px)
			const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;

			// Update states based on scroll position
			showJumpToNewest = !isNearBottom;
			isUserScrolling = true;
			shouldAutoScroll = isNearBottom;

			// Load more messages if scrolled near top and has more messages
			const scrollThreshold = 100;
			if (scrollTop <= scrollThreshold && !isLoadingMore && hasMoreMessages) {
				loadMoreMessages();
			}

			// Clear user scrolling flag after a delay
			clearTimeout(userScrollTimeout);
			userScrollTimeout = setTimeout(() => {
				isUserScrolling = false;
			}, 150);
		}

		let userScrollTimeout: NodeJS.Timeout;

		chatContent.addEventListener('scroll', handleScroll);

		return () => {
			if (chatContent) {
				chatContent.removeEventListener('scroll', handleScroll);
				clearTimeout(userScrollTimeout);
			}
		};
	});


	function updateDocumentTitle() {
		const baseTitle = `#${chatName} - Lhama Chat`;
		document.title = hasUnreadMessages ? `(*) ${baseTitle}` : baseTitle;
	}

	$effect(() => {
		updateDocumentTitle();

		// Cleanup: restore original title when component unmounts
		return () => {
			document.title = 'Lhama Chat';
		};
	});

	$effect(() => {
		async function handleFocus() {
			windowFocused = true;
			hasUnreadMessages = false;
			// Mark chat as read when user focuses the window using fresh chat data
			try {
				const chats = await apiFetchChats($authStore.token);
				const updatedChat = chats.find(c => c.id === chatId);
				if (updatedChat && updatedChat.lastMessageAt) {
					chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
				}
			} catch (error) {
				console.warn('Failed to fetch updated chat info for notifications on focus:', error);
			}
		}

		function handleBlur() {
			windowFocused = false;
		}

		async function handleVisibilityChange() {
			windowFocused = !document.hidden;
			if (!document.hidden) {
				hasUnreadMessages = false;
				// Mark chat as read when page becomes visible using fresh chat data
				try {
					const chats = await apiFetchChats($authStore.token);
					const updatedChat = chats.find(c => c.id === chatId);
					if (updatedChat && updatedChat.lastMessageAt) {
						chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
					}
				} catch (error) {
					console.warn('Failed to fetch updated chat info for notifications on visibility change:', error);
				}
			}
		}

		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('blur', handleBlur);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
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

	// Add paste event listener for images
	$effect(() => {
		document.addEventListener('paste', handlePaste);

		// Cleanup on component destroy
		return () => {
			document.removeEventListener('paste', handlePaste);
		};
	});

	// Close action menu when clicking outside
	$effect(() => {
		function handleClickOutside(event: Event) {
			const target = event.target as HTMLElement;
			if (openActionMenuId && !target.closest('.message-actions')) {
				closeActionMenu();
			}
		}

		if (openActionMenuId) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	async function loadMessages() {
		if (!$authStore.token) return;

		isLoading = true;
		error = null;

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated($authStore.token, chatId, 50);
			// Backend returns messages in DESC order (newest first), but we need chronological order (oldest first)
			messages = response.messages.reverse();
			// Backend cursors are correctly positioned: nextCursor=oldest, prevCursor=newest
			nextCursor = response.nextCursor; // Points to oldest message for loading older messages
			prevCursor = response.prevCursor; // Points to newest message for polling newer messages
			hasMoreMessages = response.hasMore;

			// Intelligent scrolling based on read status
			const lastKnownTimestamp = chatNotifications.getLastKnownTimestamp(chatId);
			if (lastKnownTimestamp && messages.length > 0) {
				// Find first unread message (first message after last known timestamp)
				const firstUnreadIndex = messages.findIndex(msg =>
					new Date(msg.createdAt) > new Date(lastKnownTimestamp)
				);

				if (firstUnreadIndex >= 0) {
					// Found unread messages, scroll to first unread message
					setTimeout(() => {
						scrollToMessage(firstUnreadIndex);
						isInitialScroll = false; // Allow future auto-scroll
					}, 100);
				} else {
					// All messages are read, scroll to bottom
					setTimeout(() => {
						scrollToBottom();
						isInitialScroll = false; // Allow future auto-scroll
					}, 100);
				}
			} else {
				// No previous read status or no messages, scroll to bottom
				setTimeout(() => {
					scrollToBottom();
					isInitialScroll = false; // Allow future auto-scroll
				}, 100);
			}

			// Mark this chat as read by fetching fresh chat info and using backend's lastMessageAt
			try {
				const chats = await apiFetchChats($authStore.token);
				const updatedChat = chats.find(c => c.id === chatId);
				if (updatedChat && updatedChat.lastMessageAt) {
					chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
				}
			} catch (error) {
				console.warn('Failed to fetch updated chat info for notifications on load:', error);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load messages';
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreMessages() {
		if (!$authStore.token || !nextCursor || isLoadingMore) return;

		isLoadingMore = true;
		shouldAutoScroll = false; // Prevent auto-scroll when loading older messages

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				$authStore.token,
				chatId,
				50,
				nextCursor // Load older messages
			);

			// Backend returns older messages in DESC order, reverse them for chronological order
			const olderMessages = response.messages.reverse();

			// Keep scroll position before updating messages
			const prevScrollHeight = chatContent.scrollHeight;
			const prevScrollTop = chatContent.scrollTop;

			// Prepend older messages to the beginning of the array
			messages = [...olderMessages, ...messages];
			nextCursor = response.nextCursor; // Update cursor for even older messages
			hasMoreMessages = response.hasMore;

			// After DOM update, maintain scroll position
			setTimeout(() => {
				const newScrollHeight = chatContent.scrollHeight;
				const scrollDifference = newScrollHeight - prevScrollHeight;
				chatContent.scrollTop = prevScrollTop + scrollDifference;
			}, 0);

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load more messages';
		} finally {
			isLoadingMore = false;
		}
	}

	async function pollForMessages() {
		if (!$authStore.token || isLoading) return;

		try {
			// Check for new messages using the current prevCursor (newest message)
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				$authStore.token,
				chatId,
				50, // Get up to 50 new messages
				undefined, // no 'before' cursor
				prevCursor // get messages after the current newest message
			);

			const currentMessageCount = messages.length;

			// Only update if we have new messages
			if (response.messages.length > 0) {
				// Check if this is a new message (not initial load) and window is not focused
				const hasNewMessages = currentMessageCount > 0;
				if (hasNewMessages && !isWindowFocused()) {
					// Check if the new messages are from other users (not current user)
					const hasOtherUserMessages = response.messages.some(msg => msg.userId !== $authStore.user?.id);

					if (hasOtherUserMessages) {
						hasUnreadMessages = true;

						// Only play notifications if chat is not muted
						const isChatMuted = chatMuteStore.isMuted(data.chatId);
						if (!isChatMuted) {
							playNotificationSound();

							// Show OS notification for new messages
							const latestMessage = response.messages[response.messages.length - 1];
							if (latestMessage) {
								showMessageNotification({
									title: `New message in ${data.chat.name}`,
									body: `${latestMessage.username}: ${latestMessage.message.length > 50 ? latestMessage.message.substring(0, 50) + '...' : latestMessage.message}`,
									chatId: data.chatId,
									tag: `chat-${data.chatId}`
								});
							}
						}
					}
				}

				// Check for new members and assign colors if using colors
				if (shouldUseColors && response.messages.length > 0) {
					// Get unique user IDs from new messages
					const newUserIds = [...new Set(response.messages.map(msg => msg.userId))];

					// Assign colors to any new members
					newUserIds.forEach(userId => {
						if (userId !== $authStore.user?.id) { // Skip own messages
							addMemberColor(chatId, userId);
						}
					});
				}

				// Backend returns new messages in DESC order, reverse them for chronological order
				const newMessages = response.messages.reverse();
				// Append new messages to the end of the array
				messages = [...messages, ...newMessages];
				prevCursor = response.prevCursor; // Update cursor to newest message

				// Mark these messages as read by fetching updated chat info and using backend's lastMessageAt
				if (newMessages.length > 0) {
					try {
						const chats = await apiFetchChats($authStore.token);
						const updatedChat = chats.find(c => c.id === chatId);
						if (updatedChat && updatedChat.lastMessageAt) {
							chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
						}
					} catch (error) {
						console.warn('Failed to fetch updated chat info for notifications:', error);
					}
				}
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
		if (!$authStore.token || (!newMessage.trim() && selectedImages.length === 0)) return;

		const messageText = newMessage.trim();
		const imagesToUpload = [...selectedImages];

		// Clear input immediately
		newMessage = '';
		selectedImages = [];
		showImageUpload = false;
		sendError = null;
		isSending = true;
		isUploadingImages = imagesToUpload.length > 0;

		// Temporarily stop polling while sending
		stopMessagePolling();

		try {
			let imageIds: string[] = [];

			// Upload images first if any are selected
			if (imagesToUpload.length > 0) {
				const uploadPromises = imagesToUpload.map(file =>
					uploadImage($authStore.token!, file)
				);

				try {
					const uploadedImages = await Promise.all(uploadPromises);
					imageIds = uploadedImages.map(img => img.id);
				} catch (uploadErr: any) {
					console.error('Failed to upload images:', uploadErr);

					// Check for specific error types
					const errorMessage = uploadErr.message || '';

					if (errorMessage.includes('413') ||
						errorMessage.includes('Failed to upload image: 413') ||
						errorMessage.includes('NetworkError when attempting to fetch resource')) {
						// 413 errors or network errors during upload are likely size-related
						throw new Error('Image too large for server. Please use a smaller image (server has lower size limits than 1MB).');
					} else {
						throw new Error('Failed to upload images: ' + (errorMessage || 'Unknown error'));
					}
				}
			}

			// Create message content with image references
			let finalMessageContent = messageText;
			if (imageIds.length > 0) {
				const imageReferences = imageIds.map(id => `image:${id}`).join('\n');
				finalMessageContent = messageText ? `${messageText}\n${imageReferences}` : imageReferences;
			}

			const sentMessage = await sendMessage($authStore.token, chatId, { message: finalMessageContent });

			// Add the new message to the messages array
			messages = [...messages, sentMessage];
			// Update the cursor so polling can detect newer messages
			prevCursor = sentMessage.id;

			// Mark this message as read by fetching updated chat info and using backend's lastMessageAt
			try {
				const chats = await apiFetchChats($authStore.token);
				const updatedChat = chats.find(c => c.id === chatId);
				if (updatedChat && updatedChat.lastMessageAt) {
					chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
				}
			} catch (error) {
				console.warn('Failed to fetch updated chat info for notifications after sending:', error);
			}

			// Ensure we scroll to bottom after sending
			shouldAutoScroll = true;
			setTimeout(scrollToBottom, 0);
		} catch (err: any) {
			console.error('Failed to send message:', err);
			sendError = err.message || 'Failed to send message';

			// Restore message and images on error
			newMessage = messageText;
			selectedImages = imagesToUpload;
			if (imagesToUpload.length > 0) {
				showImageUpload = true;
			}
		} finally {
			isSending = false;
			isUploadingImages = false;
			// Restart polling after sending
			if ($authStore.token && chatId) {
				startMessagePolling();
			}
			// Keep input focused for continuous typing
			if (messageInputElement) {
				messageInputElement.focus();
			}
		}
	}

	function handleMessageSubmit(e: Event) {
		e.preventDefault();
		handleSendMessage();
	}

	// Image upload handlers
	function handleImageFilesSelected(files: File[]) {
		selectedImages = [...selectedImages, ...files];
		if (!showImageUpload) {
			showImageUpload = true;
		}
	}

	function handleRemoveImage(index: number) {
		selectedImages = selectedImages.filter((_, i) => i !== index);
		if (selectedImages.length === 0) {
			showImageUpload = false;
		}
	}

	function toggleImageUpload() {
		showImageUpload = !showImageUpload;
		if (!showImageUpload) {
			selectedImages = [];
		}
	}

	// Handle clipboard paste for images
	function handlePaste(event: ClipboardEvent) {
		// Only handle paste if we're in the chat area (not in other inputs outside chat)
		const target = event.target as HTMLElement;
		const isInChat = target.closest('.chat-page') !== null;
		if (!isInChat) return;

		const items = event.clipboardData?.items;
		if (!items) return;

		// Look for image items in the clipboard
		const imageFiles: File[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					imageFiles.push(file);
				}
			}
		}

		// If we found images, add them to the selected images
		if (imageFiles.length > 0) {
			event.preventDefault(); // Prevent default paste behavior
			handleImageFilesSelected(imageFiles);
		}
	}

	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	async function handleDeleteMessage(messageId: string) {
		if (!$authStore.token) return;

		try {
			await deleteMessage($authStore.token, chatId, messageId);

			// Update the message in local state to show "[deleted message]"
			messages = messages.map(msg =>
				msg.id === messageId
					? { ...msg, message: '[deleted message]' }
					: msg
			);

			// Close the action menu
			openActionMenuId = null;
		} catch (err) {
			console.error('Failed to delete message:', err);
		}
	}

	function toggleActionMenu(messageId: string, event?: Event) {
		event?.stopPropagation();
		openActionMenuId = openActionMenuId === messageId ? null : messageId;
	}

	function closeActionMenu() {
		openActionMenuId = null;
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

	// Close actions menu when clicking outside
	$effect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (showActionsMenu) {
				const target = event.target as Element;
				if (!target.closest('.actions-menu')) {
					showActionsMenu = false;
				}
			}
		}

		if (showActionsMenu) {
			document.addEventListener('click', handleClickOutside);
		}

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function jumpToNewest() {
		shouldAutoScroll = true;
		showJumpToNewest = false;
		isInitialScroll = false; // Reset initial scroll flag
		scrollToBottom();
	}

	async function handleDeleteChat() {
		if (!$authStore.token) return;

		const success = await deleteChat($authStore.token, chatId);

		if (success) {
			showDeleteModal = false;
			goto('/');  // Navigate back to chat list
		}
		// Error handling is done in the store, error state will show via $chatStore.error
	}

	async function handleLeaveChat() {
		if (!$authStore.token || !$authStore.user?.id) return;

		isLeaving = true;
		try {
			await leaveChat($authStore.token, chatId, $authStore.user.id);
			showLeaveModal = false;
			goto('/');
		} catch (error) {
			console.error('Failed to leave chat:', error);
		} finally {
			isLeaving = false;
		}
	}

	// Link confirmation functions
	function handleLinkConfirmation(url: string) {
		pendingUrl = url;
		showLinkConfirmation = true;
	}

	function confirmAndOpenLink() {
		if (pendingUrl) {
			window.open(pendingUrl, '_blank', 'noopener,noreferrer');
		}
		closeLinkConfirmation();
	}

	function closeLinkConfirmation() {
		showLinkConfirmation = false;
		pendingUrl = null;
	}

	// Set up global function for link clicks
	$effect(() => {
		(window as any).showLinkConfirmation = handleLinkConfirmation;

		return () => {
			delete (window as any).showLinkConfirmation;
		};
	});
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

					<!-- Actions menu - available to all users -->
					<div class="actions-menu">
						<button
							onclick={() => showActionsMenu = !showActionsMenu}
							class="btn btn-ghost actions-toggle"
							disabled={$chatStore.isDeleting}
						>
							⋮
						</button>
						{#if showActionsMenu}
							<div class="actions-dropdown">
								<button
									onclick={() => {
										chatMuteStore.toggleMute(data.chatId);
										showActionsMenu = false;
									}}
									class="dropdown-item"
								>
									{#if $chatMuteStore.mutedChats[data.chatId]}
										Unmute
									{:else}
										Mute
									{/if}
								</button>
								{#if !isOwner}
									<button
										onclick={() => {
											showLeaveModal = true;
											showActionsMenu = false;
										}}
										class="dropdown-item danger"
										disabled={isLeaving}
									>
										{isLeaving ? 'Leaving...' : 'Leave Chat'}
									</button>
								{/if}
								{#if isOwner}
									<button
										onclick={() => {
											showDeleteModal = true;
											showActionsMenu = false;
										}}
										class="dropdown-item danger"
										disabled={$chatStore.isDeleting}
									>
										{$chatStore.isDeleting ? 'Deleting...' : 'Delete Chat'}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<!-- Main Chat Area -->
		<main class="chat-content" bind:this={chatContent}>
			<!-- Jump to newest button -->
			{#if showJumpToNewest}
				<button
					onclick={jumpToNewest}
					class="jump-to-newest-btn"
					title="Jump to newest messages"
				>
					↓ New messages
				</button>
			{/if}
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
					<!-- Auto-loading indicator -->
					{#if hasMoreMessages && isLoadingMore}
						<div class="loading-more-container">
							<div class="loading-spinner small"></div>
							<p>Loading older messages...</p>
						</div>
					{/if}

					{#each messages as message (message.id)}
						{@const isOwnMessage = message.userId === $authStore.user?.id}
						{@const memberColor = shouldUseColors && !isOwnMessage ? getMemberColor(chatId, message.userId) : null}
						{@const linkifyResult = linkify(message.message, true)}
						<div class="message-item {isOwnMessage ? 'own-message' : 'other-message'}"
						     style={memberColor ? `--current-member-color: ${memberColor}` : ''}>
							<div class="message-header">
								<span class="message-user"
								      style={memberColor ? `color: ${memberColor}` : ''}>
									{message.userId === $authStore.user?.id ? 'You' : message.username}
								</span>
								<div class="message-header-right">
									<span class="message-time">
										{new Date(message.createdAt).toLocaleString([], {
											year: 'numeric',
											month: '2-digit',
											day: '2-digit',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</span>
									{#if isOwnMessage && message.message !== '[deleted message]'}
										<div class="message-actions">
											<button class="action-btn menu-btn"
											        onclick={(e) => toggleActionMenu(message.id, e)}
											        title="Message actions">
												⋮
											</button>
											{#if openActionMenuId === message.id}
												<div class="action-dropdown">
													<button class="dropdown-item delete-item"
													        onclick={() => handleDeleteMessage(message.id)}>
														Delete
													</button>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
							<div class="message-content">
								{#if hasImages(message.message)}
									<!-- Message with images - use ParsedMessage component -->
									<ParsedMessage content={message.message} />
								{:else}
									<!-- Regular text message - use existing linkify logic -->
									{@html linkifyResult.html}

									{#if linkifyResult.previews.length > 0}
										<div class="message-previews">
											{#each linkifyResult.previews as preview (preview.url)}
												<LinkPreview
													{preview}
													onLinkClick={handleLinkConfirmation}
												/>
											{/each}
										</div>
									{/if}
								{/if}
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

			{#if showImageUpload}
				<div class="image-upload-section">
					<ImageUpload
						onFilesSelected={handleImageFilesSelected}
						selectedFiles={selectedImages}
						onRemoveFile={handleRemoveImage}
						disabled={isSending || isUploadingImages}
						maxFiles={5}
					/>
				</div>
			{/if}

			<form onsubmit={handleMessageSubmit} class="input-container">
				<button
					type="button"
					class="btn btn-secondary image-btn"
					onclick={toggleImageUpload}
					disabled={isSending || isUploadingImages}
					title="Add images"
				>
					+
				</button>
				<input
					type="text"
					bind:value={newMessage}
					bind:this={messageInputElement}
					onkeydown={handleKeyPress}
					placeholder={selectedImages.length > 0 ? 'Add a caption...' : 'Type a message...'}
					disabled={isSending || isUploadingImages}
					class="message-input"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={(isSending || isUploadingImages) || (!newMessage.trim() && selectedImages.length === 0)}
				>
					{isUploadingImages ? 'Uploading...' : isSending ? 'Sending...' : 'Send'}
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

		<!-- Delete Confirmation Modal -->
		{#if showDeleteModal}
			<div class="modal-overlay" onclick={() => showDeleteModal = false}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Delete Chat</h3>
						<button onclick={() => showDeleteModal = false} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p><strong>Are you sure you want to delete this chat?</strong></p>
						<p>This action cannot be undone. The chat "#{chatName}" and all its messages will be permanently deleted.</p>
						<div class="modal-actions">
							<button
								onclick={() => showDeleteModal = false}
								class="btn btn-ghost"
								disabled={$chatStore.isDeleting}
							>
								Cancel
							</button>
							<button
								onclick={handleDeleteChat}
								class="btn btn-danger"
								disabled={$chatStore.isDeleting}
							>
								{$chatStore.isDeleting ? 'Deleting...' : 'Delete Chat'}
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Leave Confirmation Modal -->
		{#if showLeaveModal}
			<div class="modal-overlay" onclick={() => showLeaveModal = false}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Leave Chat</h3>
						<button onclick={() => showLeaveModal = false} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p><strong>Are you sure you want to leave this chat?</strong></p>
						<p>You will no longer receive messages from "#{chatName}" and will need to be re-invited to join again.</p>
						<div class="modal-actions">
							<button
								onclick={() => showLeaveModal = false}
								class="btn btn-ghost"
								disabled={isLeaving}
							>
								Cancel
							</button>
							<button
								onclick={handleLeaveChat}
								class="btn btn-danger"
								disabled={isLeaving}
							>
								{isLeaving ? 'Leaving...' : 'Leave Chat'}
							</button>
						</div>
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

		<!-- Link Confirmation Modal -->
		{#if showLinkConfirmation && pendingUrl}
			<div class="modal-overlay" onclick={closeLinkConfirmation}>
				<div class="modal-content" onclick={(e) => e.stopPropagation()}>
					<div class="modal-header">
						<h3>Open Link</h3>
						<button onclick={closeLinkConfirmation} class="close-btn">&times;</button>
					</div>
					<div class="modal-body">
						<p>Do you want to open this link in a new tab?</p>
						<div class="link-display">
							<span class="link-url">{pendingUrl}</span>
						</div>
						<p class="link-warning">Only open links from trusted sources.</p>
						<div class="modal-actions">
							<button
								onclick={closeLinkConfirmation}
								class="btn btn-ghost"
							>
								Cancel
							</button>
							<button
								onclick={confirmAndOpenLink}
								class="btn btn-primary"
							>
								Open Link
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Chat Error (for delete operations) -->
		{#if $chatStore.error}
			<div class="error-toast alert alert-error">
				{$chatStore.error}
				<button onclick={() => chatStore.update(state => ({ ...state, error: null }))} class="close-btn">&times;</button>
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
		gap: 0.5rem;
		padding: 1rem 0;
	}

	/* Auto-loading indicator */
	.loading-more-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.loading-spinner.small {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border-light);
		border-top: 2px solid var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.message-item {
		border-radius: 12px;
		padding: 0.75rem;
		max-width: 70%;
		margin-bottom: 0.25rem;
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
		border-left: 3px solid var(--current-member-color, var(--border-color));
		align-self: flex-start;
		border-bottom-left-radius: 4px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
		gap: 0.5rem;
	}

	.message-user {
		font-weight: 600;
		color: var(--current-member-color, var(--accent));
		font-size: 0.85rem;
	}

	.message-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.message-time {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.message-content {
		color: var(--text-primary);
		line-height: 1.5;
		word-wrap: break-word;
	}

	.message-previews {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Message actions menu */
	.message-actions {
		opacity: 0;
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		transition: opacity 0.2s ease;
	}

	.message-item:hover .message-actions {
		opacity: 1;
	}

	.action-btn {
		background: var(--accent);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		padding: 0.25rem;
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: var(--accent-hover);
		transform: scale(1.05);
	}

	.menu-btn {
		font-weight: bold;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.menu-btn:hover {
		color: white;
	}

	/* Action dropdown menu */
	.action-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 12px var(--shadow);
		z-index: 1000;
		min-width: 120px;
		margin-top: 4px;
		animation: fadeInDropdown 0.1s ease-out;
	}

	@keyframes fadeInDropdown {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--text-primary);
		transition: background-color 0.2s ease;
		border-radius: 6px;
	}

	.dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.delete-item {
		color: var(--danger);
	}

	.delete-item:hover {
		background: rgba(220, 53, 69, 0.1);
		color: var(--danger-hover);
	}

	/* Dark theme specific override for delete item hover */
	[data-theme='dark'] .delete-item:hover {
		background: rgba(229, 62, 62, 0.15);
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

	/* Link styling in messages */
	.message-content :global(.message-link) {
		color: var(--accent);
		text-decoration: underline;
		word-break: break-all;
		transition: all 0.2s ease;
	}

	.message-content :global(.message-link):hover {
		color: var(--accent-dark, var(--accent));
		text-decoration: none;
	}

	/* Link styling in own messages (white background) */
	.own-message .message-content :global(.message-link) {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: underline;
	}

	.own-message .message-content :global(.message-link):hover {
		color: white;
		text-decoration: none;
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

	.image-upload-section {
		max-width: 1200px;
		margin: 0 auto 1rem auto;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px solid var(--border-light);
		padding: 1rem;
	}

	.image-btn {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		padding: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-medium);
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.image-btn:hover:not(:disabled) {
		background: var(--bg-hover);
		border-color: var(--border-primary);
	}

	.image-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-images {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
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
			justify-content: space-between;
			align-items: center;
			gap: 0.5rem;
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

		.image-upload-section {
			padding: 0.75rem;
		}

		.image-btn {
			width: 36px;
			height: 36px;
			font-size: 14px;
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

		.message-header {
			gap: 0.25rem;
		}

		.message-time {
			font-size: 0.7rem;
		}
	}

	/* Very small screens - truncate group name */
	@media (max-width: 428px) {
		.header-content h1 {
			max-width: 6ch;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	/* Invitation Button */
	.invite-btn {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
	}

	/* Actions Menu */
	.actions-menu {
		position: relative;
	}

	.actions-toggle {
		font-size: 1.2rem;
		padding: 0.5rem 0.75rem;
		font-weight: bold;
		line-height: 1;
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
		min-width: 120px;
		margin-top: 0.5rem;
	}

	.dropdown-item {
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

	.dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.dropdown-item.danger {
		color: var(--danger);
	}

	.dropdown-item.danger:hover {
		background: var(--danger);
		color: white;
	}

	.dropdown-item:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.modal-actions button {
		min-width: 100px;
	}

	/* Link confirmation modal styles */
	.link-display {
		margin: 1rem 0;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px solid var(--border-light);
		word-break: break-all;
	}

	.link-url {
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.9rem;
		color: var(--accent);
		display: block;
		text-align: center;
	}

	.link-warning {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
		font-style: italic;
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

	/* Jump to Newest Button */
	.jump-to-newest-btn {
		position: absolute;
		bottom: 2rem;
		right: 2rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 25px;
		padding: 0.75rem 1.25rem;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		z-index: 100;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: all 0.2s ease;
		animation: slideInUp 0.3s ease-out;
	}

	.jump-to-newest-btn:hover {
		background: var(--accent-dark, var(--accent));
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
	}

	.jump-to-newest-btn:active {
		transform: translateY(0);
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Mobile responsiveness for jump button */
	@media (max-width: 768px) {
		.jump-to-newest-btn {
			bottom: 1.5rem;
			right: 1.5rem;
			padding: 0.6rem 1rem;
			font-size: 0.8rem;
		}
	}

	@media (max-width: 480px) {
		.jump-to-newest-btn {
			bottom: 1rem;
			right: 1rem;
			padding: 0.5rem 0.9rem;
			font-size: 0.75rem;
		}
	}
</style>
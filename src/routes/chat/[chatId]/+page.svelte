<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { chatStore, deleteChat } from '$lib/stores/chat';
	import { fetchMessages, fetchMessagesPaginated, sendMessage, createInvitation, fetchChats as apiFetchChats, deleteMessage, leaveChat, uploadImage, toggleMessageFavorite, fetchFavoriteMessages } from '$lib/api/chat';
	import type { Message, Chat, PagedMessageResponse } from '$lib/types/chat';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import ParsedMessage from '$lib/components/ParsedMessage.svelte';
	import MessageGif from '$lib/components/MessageGif.svelte';
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
	import { hasReply, formatReplyMessage } from '$lib/utils/replyMessages';
	import ReplyPreview from '$lib/components/ReplyPreview.svelte';

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

	let newMessage = $state('');
	let isSending = $state(false);
	let sendError = $state<string | null>(null);

	let selectedImages = $state<File[]>([]);
	let isUploadingImages = $state(false);
	let showImageUpload = $state(false);

	let showInviteModal = $state(false);
	let inviteCode = $state<string | null>(null);
	let isCreatingInvite = $state(false);
	let inviteError = $state<string | null>(null);

	let showDeleteModal = $state(false);
	let showLeaveModal = $state(false);
	let isLeaving = $state(false);
	let showActionsMenu = $state(false);
	let openActionMenuId = $state<string | null>(null);

	let showLinkConfirmation = $state(false);
	let pendingUrl = $state<string | null>(null);

	let pollingInterval: NodeJS.Timeout | null = null;
	let currentPollingDelay = 3000; // Start with 3 seconds
	let consecutiveEmptyPolls = 0;
	let isActivelyPolling = false;
	let messageInputElement: HTMLTextAreaElement;
	let chatContent: HTMLElement;
	let windowFocused = $state(true);
	let hasUnreadMessages = $state(false);

	let nextCursor = $state<string | null>(null);
	let prevCursor = $state<string | null>(null);
	let hasMoreMessages = $state(false);
	let isLoadingMore = $state(false);

	let shouldAutoScroll = $state(true);
	let showJumpToNewest = $state(false);
	let isUserScrolling = $state(false);
	let isInitialScroll = $state(true);

	let shouldUseColors = $state(false);

	let replyingTo = $state<Message | null>(null);
	let highlightedMessageId = $state<string | null>(null);
	let selectedMessageIndex = $state(-1);

	// Track favorited messages locally
	let favoriteMessageIds = $state(new Set<string>());

	const chatId = data.chatId;
	const currentChat = data.chat;
	const chatName = currentChat.name;
	const isOwner = data.isOwner;

	// Memory management constants
	const MAX_MESSAGES_IN_MEMORY = 500; // Keep max 500 messages in memory
	const CLEANUP_THRESHOLD = 600; // Cleanup when we exceed this

	/**
	 * Cleans up message array to prevent unbounded memory growth
	 * Keeps recent messages and preserves scroll position
	 */
	function cleanupMessages() {
		if (messages.length > CLEANUP_THRESHOLD) {
			// Keep the most recent messages (from the end of the array)
			const newMessages = messages.slice(-MAX_MESSAGES_IN_MEMORY);
			messages = newMessages;

			// If we cleaned up older messages, we have more to load
			hasMoreMessages = true;

			console.log(`Cleaned up messages: kept ${newMessages.length} out of ${messages.length + (CLEANUP_THRESHOLD - newMessages.length)}`);
		}
	}

	$effect(() => {
		if ($authStore.token && chatId) {
			loadMemberColors();
			shouldUseColors = shouldUseMemberColors(currentChat.members);
			if (shouldUseColors) {
				assignColorsForChat(chatId, currentChat.members);
			}
			loadMessages();
			loadFavoriteMessages();
		}
	});

	$effect(() => {
		if (messageInputElement && !isSending) {
			// Only auto-focus on desktop, not on mobile
			const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
				|| window.matchMedia('(max-width: 768px)').matches;

			if (!isMobile) {
				messageInputElement.focus();
			}
		}
	});

	$effect(() => {
		if (messageInputElement && newMessage !== undefined) {
			messageInputElement.style.height = 'auto';
			const newHeight = Math.min(messageInputElement.scrollHeight, 120);
			messageInputElement.style.height = newHeight + 'px';
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
				const messageElements = chatContent.querySelectorAll('.message-item');
				if (messageElements[messageIndex]) {
					messageElements[messageIndex].scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});
				}
			}, 100);
		}
	}

	$effect(() => {
		if (messages.length > 0 && shouldAutoScroll && !isUserScrolling && !isInitialScroll) {
			scrollToBottom();
		}
	});

	$effect(() => {
		if (!chatContent) return;

		function handleScroll() {
			if (!chatContent) return;

			const scrollTop = chatContent.scrollTop;
			const scrollHeight = chatContent.scrollHeight;
			const clientHeight = chatContent.clientHeight;

			const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;

			showJumpToNewest = !isNearBottom;
			isUserScrolling = true;
			shouldAutoScroll = isNearBottom;

			const scrollThreshold = 100;
			if (scrollTop <= scrollThreshold && !isLoadingMore && hasMoreMessages) {
				loadMoreMessages();
			}

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
		return () => {
			document.title = 'Lhama Chat';
		};
	});

	$effect(() => {
		async function handleFocus() {
			windowFocused = true;
			hasUnreadMessages = false;
			// Increase polling frequency when window gains focus
			if (pollingInterval) {
				stopMessagePolling();
				startMessagePolling();
			}
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
			// Reduce polling frequency when window loses focus
			if (pollingInterval) {
				stopMessagePolling();
				startMessagePolling();
			}
		}

		async function handleVisibilityChange() {
			windowFocused = !document.hidden;
			if (!document.hidden) {
				hasUnreadMessages = false;
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

	$effect(() => {
		if ($authStore.token && chatId && !isLoading && messages.length >= 0) {
			startMessagePolling();
		} else {
			stopMessagePolling();
		}

		return () => {
			stopMessagePolling();
		};
	});

	$effect(() => {
		document.addEventListener('paste', handlePaste);

		return () => {
			document.removeEventListener('paste', handlePaste);
		};
	});

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
			messages = response.messages.reverse();
			nextCursor = response.nextCursor;
			prevCursor = response.prevCursor;
			hasMoreMessages = response.hasMore;

			const lastKnownTimestamp = chatNotifications.getLastKnownTimestamp(chatId);
			if (lastKnownTimestamp && messages.length > 0) {
				const firstUnreadIndex = messages.findIndex(msg =>
					new Date(msg.createdAt) > new Date(lastKnownTimestamp)
				);

				if (firstUnreadIndex >= 0) {
					setTimeout(() => {
						scrollToMessage(firstUnreadIndex);
						isInitialScroll = false;
					}, 100);
				} else {
					setTimeout(() => {
						scrollToBottom();
						isInitialScroll = false;
					}, 100);
				}
			} else {
				setTimeout(() => {
					scrollToBottom();
					isInitialScroll = false;
				}, 100);
			}

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

	async function loadFavoriteMessages() {
		if (!$authStore.token) return;

		try {
			const favorites = await fetchFavoriteMessages($authStore.token, chatId);
			const favoriteIds = favorites.map(fav => fav.messageId);
			favoriteMessageIds = new Set(favoriteIds);
		} catch (err) {
			console.error('Failed to load favorite messages:', err);
			// Don't show error to user, this is not critical functionality
		}
	}

	async function loadMoreMessages() {
		if (!$authStore.token || !nextCursor || isLoadingMore) return;

		isLoadingMore = true;
		shouldAutoScroll = false;

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				$authStore.token,
				chatId,
				50,
				nextCursor
			);

			const olderMessages = response.messages.reverse();
			const prevScrollHeight = chatContent.scrollHeight;
			const prevScrollTop = chatContent.scrollTop;

			messages = [...olderMessages, ...messages];
			nextCursor = response.nextCursor;
			hasMoreMessages = response.hasMore;

			// Clean up messages if we have too many
			cleanupMessages();

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

	/**
	 * Calculates the next polling delay based on activity
	 */
	function getNextPollingDelay(): number {
		// const MIN_DELAY = 2000; // 2 seconds minimum
		// const MAX_DELAY = 15000; // 15 seconds maximum
		//
		// // If window is focused, poll more frequently
		// if (windowFocused) {
		// 	return Math.min(3000 + (consecutiveEmptyPolls * 500), 8000);
		// }
		//
		// // If window is not focused, poll less frequently
		// return Math.min(5000 + (consecutiveEmptyPolls * 1000), MAX_DELAY);

		return 1000;
	}

	async function pollForMessages() {
		if (!$authStore.token || isLoading || isActivelyPolling) return;

		isActivelyPolling = true;

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				$authStore.token,
				chatId,
				50,
				undefined,
				prevCursor
			);

			const currentMessageCount = messages.length;

			if (response.messages.length > 0) {
				// Reset empty poll counter when we get messages
				consecutiveEmptyPolls = 0;

				const hasNewMessages = currentMessageCount > 0;
				if (hasNewMessages && !isWindowFocused()) {
					const hasOtherUserMessages = response.messages.some(msg => msg.userId !== $authStore.user?.id);

					if (hasOtherUserMessages) {
						hasUnreadMessages = true;

						const isChatMuted = chatMuteStore.isMuted(data.chatId);
						if (!isChatMuted) {
							playNotificationSound();

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

				if (shouldUseColors && response.messages.length > 0) {
					const newUserIds = [...new Set(response.messages.map(msg => msg.userId))];

					newUserIds.forEach(userId => {
						if (userId !== $authStore.user?.id) {
							addMemberColor(chatId, userId);
						}
					});
				}

				const newMessages = response.messages.reverse();
				messages = [...messages, ...newMessages];
				prevCursor = response.prevCursor;

				// Clean up messages if we have too many
				cleanupMessages();

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
			} else {
				// Increment empty poll counter when no new messages
				consecutiveEmptyPolls = Math.min(consecutiveEmptyPolls + 1, 10);
			}

			// Reset consecutive error counter on success
			consecutiveEmptyPolls = Math.max(0, consecutiveEmptyPolls - 1);

		} catch (err) {
			console.error('Message polling error:', err);
			// Increase delay on errors
			consecutiveEmptyPolls = Math.min(consecutiveEmptyPolls + 2, 10);
		} finally {
			isActivelyPolling = false;
		}
	}

	function scheduleNextPoll() {
		if (pollingInterval) {
			clearTimeout(pollingInterval);
		}

		const delay = getNextPollingDelay();
		pollingInterval = setTimeout(() => {
			pollForMessages().then(() => {
				// Schedule next poll after this one completes
				if ($authStore.token && chatId && !isLoading) {
					scheduleNextPoll();
				}
			});
		}, delay);
	}

	function startMessagePolling() {
		if (pollingInterval) return;

		// Reset polling state
		consecutiveEmptyPolls = 0;
		currentPollingDelay = 3000;

		// Schedule the first poll
		scheduleNextPoll();
	}

	function stopMessagePolling() {
		if (pollingInterval) {
			clearTimeout(pollingInterval);
			pollingInterval = null;
		}
		isActivelyPolling = false;
	}

	function goBack() {
		stopMessagePolling();
		goto('/');
	}

	async function handleSendMessage() {
		if (!$authStore.token || (!newMessage.trim() && selectedImages.length === 0)) return;

		const messageText = newMessage.trim();
		const imagesToUpload = [...selectedImages];
		const replyToMessage = replyingTo;

		// Clear input immediately
		newMessage = '';
		selectedImages = [];
		replyingTo = null;
		showImageUpload = false;
		sendError = null;
		isSending = true;
		isUploadingImages = imagesToUpload.length > 0;
		selectedMessageIndex = -1;

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

			// Create message content with reply and/or image references
			let finalMessageContent = messageText;
			if (replyToMessage) {
				finalMessageContent = formatReplyMessage(replyToMessage.id, messageText, imageIds);
			} else if (imageIds.length > 0) {
				const imageReferences = imageIds.map(id => `image:${id}`).join('\n');
				finalMessageContent = messageText ? `${messageText}\n${imageReferences}` : imageReferences;
			}

			const sentMessage = await sendMessage($authStore.token, chatId, { message: finalMessageContent });

			// Add the new message to the messages array
			messages = [...messages, sentMessage];
			// Update the cursor so polling can detect newer messages
			prevCursor = sentMessage.id;

			// Clean up messages if we have too many
			cleanupMessages();

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
			replyingTo = replyToMessage;
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

		if (imageFiles.length > 0) {
			event.preventDefault();
			handleImageFilesSelected(imageFiles);
		}
	}

	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
		if (e.key === 'Escape' && replyingTo) {
			e.preventDefault();
			cancelReply();
		}
		if (e.key === 'q' && e.ctrlKey) {
			e.preventDefault();
			messageInputElement?.blur();
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

	function handleReplyToMessage(message: Message) {
		replyingTo = message;
		closeActionMenu();
		setTimeout(() => messageInputElement?.focus(), 100);
	}

	async function handleToggleFavorite(messageId: string) {
		if (!$authStore.token) return;

		try {
			await toggleMessageFavorite($authStore.token, chatId, messageId);

			// Toggle the favorite status locally
			if (favoriteMessageIds.has(messageId)) {
				favoriteMessageIds.delete(messageId);
			} else {
				favoriteMessageIds.add(messageId);
			}
			// Trigger reactivity
			favoriteMessageIds = new Set(favoriteMessageIds);

			closeActionMenu();
		} catch (err) {
			console.error('Failed to toggle message favorite:', err);
		}
	}

	function cancelReply() {
		replyingTo = null;
	}

	function handleReplyClick(messageId: string) {
		const index = messages.findIndex(m => m.id === messageId);
		if (index >= 0) {
			scrollToMessage(index);
			highlightMessage(messageId);
		}
	}

	function highlightMessage(messageId: string) {
		highlightedMessageId = messageId;
		setTimeout(() => (highlightedMessageId = null), 2000);
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

	async function jumpToNewest() {
		shouldAutoScroll = true;
		showJumpToNewest = false;
		isInitialScroll = false; // Reset initial scroll flag
		scrollToBottom();

		// Mark all messages as read when explicitly jumping to newest
		if ($authStore.token) {
			try {
				const chats = await apiFetchChats($authStore.token);
				const updatedChat = chats.find(c => c.id === chatId);
				if (updatedChat && updatedChat.lastMessageAt) {
					chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
				}
			} catch (error) {
				console.warn('Failed to fetch updated chat info for notifications on jump to newest:', error);
			}
		}
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

	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				const imageModal = document.querySelector('.image-modal-overlay');
				const gifModal = document.querySelector('.gif-modal-overlay');
				if (imageModal || gifModal) {
					return;
				}

				event.preventDefault();
				goBack();
			}

			if (event.key === 'i' && document.activeElement !== messageInputElement) {
				event.preventDefault();
				messageInputElement?.focus();
			}

			// Handle arrow keys for message navigation (only when not typing in input)
			if (document.activeElement === messageInputElement) {
				return; // Don't handle arrow keys or 'r' while typing
			}

			// Check if any modal is open
			const modal = document.querySelector('.modal-overlay');
			if (modal) {
				return; // Don't handle navigation shortcuts in modals
			}

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				if (selectedMessageIndex < messages.length - 1) {
					selectedMessageIndex += 1;
					scrollToMessage(selectedMessageIndex);
				}
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				if (selectedMessageIndex > 0) {
					selectedMessageIndex -= 1;
					scrollToMessage(selectedMessageIndex);
				} else if (selectedMessageIndex === -1 && messages.length > 0) {
					selectedMessageIndex = messages.length - 1;
					scrollToMessage(selectedMessageIndex);
				}
			}

			if (event.key === 'r' && selectedMessageIndex >= 0 && selectedMessageIndex < messages.length) {
				event.preventDefault();
				handleReplyToMessage(messages[selectedMessageIndex]);
				selectedMessageIndex = -1; // Reset selection after replying
			}
		}

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
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
						←
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
					↓ Jump to newer messages
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

					{#each messages as message, index (message.id)}
						{@const isOwnMessage = message.userId === $authStore.user?.id}
						{@const memberColor = shouldUseColors && !isOwnMessage ? getMemberColor(chatId, message.userId) : null}
						{@const linkifyResult = linkify(message.message, true)}
						<div class="message-item {isOwnMessage ? 'own-message' : 'other-message'}"
						     class:highlighted={highlightedMessageId === message.id}
						     class:selected={selectedMessageIndex === index}
						     class:favorited={favoriteMessageIds.has(message.id)}
						     style={memberColor ? `--current-member-color: ${memberColor}` : ''}>
							<div class="message-header">
								<span class="message-user"
								      style={memberColor ? `color: ${memberColor}` : ''}>
									{message.userId === $authStore.user?.id ? 'You' : message.username}
									{#if favoriteMessageIds.has(message.id)}
										<span class="favorite-indicator">★</span>
									{/if}
								</span>
								<div class="message-header-right">
									{#if message.message !== '[deleted message]'}
										<div class="message-actions">
											<button class="action-btn menu-btn"
											        onclick={(e) => toggleActionMenu(message.id, e)}
											        title="Message actions">
												⋮
											</button>
											{#if openActionMenuId === message.id}
												<div class="action-dropdown">
													<button class="dropdown-item reply-item"
													        onclick={() => handleReplyToMessage(message)}>
														↩ Reply
													</button>
													<button class="dropdown-item favorite-item"
													        onclick={() => handleToggleFavorite(message.id)}>
														{favoriteMessageIds.has(message.id) ? '★ Unfavorite' : '☆ Favorite'}
													</button>
													{#if isOwnMessage}
														<button class="dropdown-item delete-item"
														        onclick={() => handleDeleteMessage(message.id)}>
															🗑 Delete
														</button>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
									<span class="message-time">
										{new Date(message.createdAt).toLocaleString([], {
											year: 'numeric',
											month: '2-digit',
											day: '2-digit',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</span>
								</div>
							</div>
							<div class="message-content">
								{#if hasImages(message.message) || hasReply(message.message)}
									<!-- Message with images or replies - use ParsedMessage component -->
									<ParsedMessage
										content={message.message}
										messages={messages}
										onReplyClick={handleReplyClick}
									/>
								{:else}
									<!-- Regular text message - use existing linkify logic -->
									{@html linkifyResult.html}

									{#if linkifyResult.gifs && linkifyResult.gifs.length > 0}
										<div class="message-gifs">
											{#each linkifyResult.gifs as gif (gif.id)}
												<MessageGif {gif} />
											{/each}
										</div>
									{/if}

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

			{#if replyingTo}
				<div class="reply-composition-container">
					<ReplyPreview
						message={replyingTo}
						mode="composition"
						onCancel={cancelReply}
					/>
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
				<textarea
					rows="1"
					bind:value={newMessage}
					bind:this={messageInputElement}
					onkeydown={handleKeyPress}
					onfocus={() => { selectedMessageIndex = -1; }}
					placeholder={selectedImages.length > 0 ? 'Add a caption...' : 'Type a message...'}
					disabled={isSending || isUploadingImages}
					class="message-input"
				></textarea>
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
		position: relative;
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

	@keyframes highlightPulse {
		0% {
			background: rgba(255, 235, 59, 0.4);
			transform: scale(1.02);
		}
		50% {
			background: rgba(255, 235, 59, 0.2);
		}
		100% {
			background: transparent;
			transform: scale(1);
		}
	}

	.message-item.highlighted {
		animation: highlightPulse 2s ease-out;
	}

	.message-item.selected {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.message-item.favorited {
		border-left: 3px solid gold;
		box-shadow: 0 2px 8px rgba(255, 215, 0, 0.2);
	}

	.message-item.favorited.own-message {
		border-right: 3px solid gold;
		border-left: 1px solid var(--accent);
	}

	.own-message {
		background: var(--accent);
		color: white;
		border: 1px solid var(--accent);
		align-self: flex-end;
		border-bottom-right-radius: 4px;
	}

	.other-message {
		background: rgba(59, 130, 246, 0.08);
		border: 1px solid rgba(59, 130, 246, 0.15);
		border-left: 3px solid var(--current-member-color, var(--border-color));
		align-self: flex-start;
		border-bottom-left-radius: 4px;
	}

	/* Dark theme override for other messages - keep original dark styling */
	[data-theme='dark'] .other-message {
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
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
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.favorite-indicator {
		color: gold;
		font-size: 0.8rem;
		display: inline-block;
		margin-left: 0.25rem;
	}

	.message-header-right {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.message-time {
		color: var(--text-muted);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.message-content {
		color: var(--text-primary);
		line-height: 1.5;
		word-wrap: break-word;
		white-space: pre-line;
		overflow-wrap: break-word;
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
		position: absolute;
		top: -2px;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		transition: opacity 0.2s ease;
	}

	.own-message .message-actions {
		left: -28px;
	}

	.other-message .message-actions {
		right: -28px;
	}

	.message-item:hover .message-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: none;
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
		background: transparent;
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

	.reply-item {
		color: var(--accent);
	}

	.reply-item:hover {
		background: rgba(var(--accent-rgb, 0, 123, 255), 0.1);
	}

	.favorite-item {
		color: gold;
	}

	.favorite-item:hover {
		background: rgba(255, 215, 0, 0.1);
	}

	/* Position menu on left for other messages */
	.other-message .action-dropdown {
		right: auto;
		left: 0;
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

	.reply-composition-container {
		max-width: 1200px;
		margin: 0 auto 0.5rem auto;
	}

	.input-container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.input-container .btn {
		height: 48px;
		padding: 0 1.5rem;
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
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		padding: 0;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		color: var(--text-primary);
		transition: all 0.2s ease;
		box-sizing: border-box;
	}

	.image-btn:hover:not(:disabled) {
		background: var(--bg-secondary);
		border-color: var(--accent);
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

	.message-gifs {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
	}

	.message-input {
		flex: 1;
		padding: 0.5rem 1rem;
		border-radius: 10px;
		border: 2px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 1rem;
		resize: none;
		overflow-y: auto;
		height: 48px;
		min-height: 48px;
		max-height: 120px;
		line-height: 1.5;
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
		box-sizing: border-box;
	}

	.message-input::-webkit-scrollbar {
		display: none;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

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

		.input-container .btn {
			height: 36px;
			padding: 0 1rem;
		}

		.message-input {
			height: 36px;
			min-height: 36px;
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
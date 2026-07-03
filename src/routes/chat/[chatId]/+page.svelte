<script lang="ts">
	import { goto } from '$app/navigation';
	import { authStore, getValidToken } from '$lib/stores/auth';
	import { chatStore, deleteChat } from '$lib/stores/chat';
	import { webSocketService, websocketStore } from '$lib/stores/websocket';
	import { mqttService } from '$lib/stores/mqtt';
	import { fetchMessagesPaginated, sendMessage, createInvitation, fetchChats as apiFetchChats, deleteMessage, leaveChat, uploadImage, toggleMessageFavorite, fetchFavoriteMessages, reactToMessage, fetchMultipleMessageReactions } from '$lib/api/chat';
	import type { Message, Chat, PagedMessageResponse } from '$lib/types/chat';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import ParsedMessage from '$lib/components/ParsedMessage.svelte';
	import MessageGif from '$lib/components/MessageGif.svelte';
	import MessageReactions from '$lib/components/MessageReactions.svelte';
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
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import EmojiAutocomplete from '$lib/components/EmojiAutocomplete.svelte';
	import { searchEmojis } from '$lib/utils/emojis';
	import { PUBLIC_REALTIME_MODE } from '$env/static/public';
	import { mergeMessagesWithPerMessageReactions, getUserReactionForMessage } from '$lib/utils/reactionUtils';
	import type { ReactionSummary } from '$lib/types/chat';
	import Modal from '$lib/components/ui/Modal.svelte';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	// Realtime mode: 'websocket' or 'polling'
	const realtimeMode = PUBLIC_REALTIME_MODE || 'websocket';

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
	let openActionMenuId = $state<string | null>(null);

	let showLinkConfirmation = $state(false);
	let linkOpenError = $state<string | null>(null);
	let pendingUrl = $state<string | null>(null);

	let showEmojiPicker = $state(false);
	let emojiQuery = $state('');
	let emojiAutocompleteIndex = $state(0);
	let showEmojiAutocomplete = $state(false);

	let websocketUnsubscribe: (() => void) | null = null;
	let mqttUnsubscribe: (() => void) | null = null;
	let isConnectingWebSocket = false;
	let websocketError = $state<string | null>(null);
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	const POLLING_INTERVAL_MS = 1000;
	let reactionPollingInterval: ReturnType<typeof setInterval> | null = null;
	const REACTION_POLLING_INTERVAL_MS = 10000; // Poll reactions every 10 seconds
	let messageInputElement = $state<HTMLTextAreaElement>(undefined!);
	let chatContent = $state<HTMLElement>(undefined!);
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

	const chatId = $derived(data.chatId);
	const currentChat = $derived(data.chat);
	const chatName = $derived(currentChat.name);
	const isOwner = $derived(data.isOwner);

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
		if ($authStore.token && chatId && $authStore.user) {
			loadMemberColors();
			shouldUseColors = shouldUseMemberColors(currentChat.members);
			if (shouldUseColors) {
				assignColorsForChat(chatId, currentChat.members);
			}
			loadMessages();
			loadFavoriteMessages();
			startReactionPolling(); // Start polling reactions on initial load

			// Use WebSocket, MQTT, or polling based on realtime mode
			if (realtimeMode === 'websocket') {
				connectWebSocket();
			} else if (realtimeMode === 'mqtt') {
				connectMqtt();
			} else {
				startPolling();
			}
		}

		return () => {
			if (realtimeMode === 'websocket') {
				disconnectWebSocket();
			} else if (realtimeMode === 'mqtt') {
				disconnectMqtt();
			} else {
				stopPolling();
			}
		};
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
			startReactionPolling();
			const token = $authStore.token;
			if (!token) return;

			if (realtimeMode === 'mqtt') {
				mqttService.ensureConnected();
				await refreshLatestMessages();
			}

			try {
				const chats = await apiFetchChats(token);
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
			stopReactionPolling();
		}

		async function handleVisibilityChange() {
			windowFocused = !document.hidden;
			if (!document.hidden) {
				startReactionPolling();
				hasUnreadMessages = false;
				const token = $authStore.token;
				if (!token) return;

				if (realtimeMode === 'mqtt') {
					mqttService.ensureConnected();
					await refreshLatestMessages();
				}

				try {
					const chats = await apiFetchChats(token);
					const updatedChat = chats.find(c => c.id === chatId);
					if (updatedChat && updatedChat.lastMessageAt) {
						chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
					}
				} catch (error) {
					console.warn('Failed to fetch updated chat info for notifications on visibility change:', error);
				}
			} else {
				stopReactionPolling(); // Stop polling when page becomes hidden
			}
		}

		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('blur', handleBlur);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			stopReactionPolling(); // Cleanup reaction polling on component destroy
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

	async function connectWebSocket() {
		const token = $authStore.token;
		if (!token || isConnectingWebSocket) return;

		try {
			isConnectingWebSocket = true;
			websocketError = null;

			await webSocketService.connect(token);

			// Subscribe to this chat's messages
			websocketUnsubscribe = webSocketService.subscribeToChat(chatId, handleWebSocketMessage);

			console.log(`Connected to WebSocket and subscribed to chat: ${chatId}`);
		} catch (error) {
			console.error('Failed to connect WebSocket:', error);
			websocketError = error instanceof Error ? error.message : 'WebSocket connection failed';
		} finally {
			isConnectingWebSocket = false;
		}
	}

	function disconnectWebSocket() {
		if (websocketUnsubscribe) {
			websocketUnsubscribe();
			websocketUnsubscribe = null;
		}
		webSocketService.disconnect();
	}

	async function connectMqtt() {
		if (!$authStore.token) return;
		try {
			await mqttService.connect($authStore.token);
			mqttUnsubscribe = mqttService.subscribeToChat(chatId, handleWebSocketMessage);
		} catch (error) {
			console.error('Failed to connect MQTT:', error);
		}
	}

	function disconnectMqtt() {
		if (mqttUnsubscribe) {
			mqttUnsubscribe();
			mqttUnsubscribe = null;
		}
		mqttService.disconnect();
	}

	// Polling functions for REST mode
	function startPolling() {
		if (pollingInterval) return;

		console.log('Starting message polling (REST mode)');
		pollingInterval = setInterval(pollForNewMessages, POLLING_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollingInterval) {
			console.log('Stopping message polling');
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	async function pollForNewMessages() {
		const token = $authStore.token;
		if (!token || !prevCursor) return;

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				token,
				chatId,
				50,
				undefined, // no 'before' cursor
				prevCursor // 'after' cursor - get messages after this timestamp
			);

			if (response.messages.length > 0) {
				// Messages come in desc order, reverse to get chronological
				const newMessages = response.messages.reverse();

				// Filter out any messages we already have
				const existingIds = new Set(messages.map(m => m.id));
				const trulyNewMessages = newMessages.filter(m => !existingIds.has(m.id));

				if (trulyNewMessages.length > 0) {
					// Process each new message similar to WebSocket handler
					for (const msg of trulyNewMessages) {
						handleNewMessage(msg);
					}

					// Update cursor to the newest message
					prevCursor = response.prevCursor;
				}
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : '';
			if (errMsg.includes('401') || errMsg.includes('403')) {
				stopPolling();
				return;
			}
			console.error('Failed to poll for new messages:', error);
		}
	}

	function handleNewMessage(newMsg: Message) {
		// Add the new message to the messages array
		messages = [...messages, newMsg];

		// Refresh reactions when there's chat activity to show others' reactions
		refreshReactions();

		// Handle notifications for messages from other users
		if (newMsg.userId !== $authStore.user?.id && !isWindowFocused()) {
			hasUnreadMessages = true;

			const isChatMuted = chatMuteStore.isMuted(data.chatId);
			if (!isChatMuted) {
				playNotificationSound();
				showMessageNotification({
					title: `New message in ${data.chat.name}`,
					body: `${newMsg.username}: ${newMsg.message.length > 50
						? newMsg.message.substring(0, 50) + '...'
						: newMsg.message}`,
					chatId: data.chatId,
					tag: `chat-${data.chatId}`
				});
			}
		}

		// Update colors if needed
		if (shouldUseColors && newMsg.userId !== $authStore.user?.id) {
			addMemberColor(chatId, newMsg.userId);
		}

		// Clean up messages if we have too many
		cleanupMessages();
	}

	function handleWebSocketMessage(newMessage: Message) {
		handleNewMessage(newMessage);

		const token = $authStore.token;
		if (!token) return;
		apiFetchChats(token).then(chats => {
			const updatedChat = chats.find(c => c.id === chatId);
			if (updatedChat && updatedChat.lastMessageAt) {
				chatNotifications.markChatAsRead(chatId, updatedChat.lastMessageAt);
			}
		}).catch(error => {
			console.warn('Failed to fetch updated chat info for notifications:', error);
		});
	}

	async function loadMessages() {
		const token = $authStore.token;
		if (!token || !$authStore.user) return;

		isLoading = true;
		error = null;

		try {
			// Fetch messages first
			const messagesResponse = await fetchMessagesPaginated(token, chatId, 50);
			const reversedMessages = messagesResponse.messages.reverse();

			// Fetch reactions for all visible messages in parallel
			const messageIds = reversedMessages.map(m => m.id);
			const reactionsByMessage = await fetchMultipleMessageReactions(token, chatId, messageIds);

			// Create member mapping from chat data
			const memberMapping: { [userId: string]: string } = {};
			for (const member of data.chat.members) {
				memberMapping[member.id] = member.name;
			}

			// Merge reactions with messages
			const messagesWithReactions = mergeMessagesWithPerMessageReactions(
				reversedMessages,
				reactionsByMessage,
				memberMapping
			);

			messages = messagesWithReactions;
			nextCursor = messagesResponse.nextCursor;
			prevCursor = messagesResponse.prevCursor;
			hasMoreMessages = messagesResponse.hasMore;

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
				const chats = await apiFetchChats(token);
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

	async function refreshLatestMessages() {
		const token = $authStore.token;
		if (!token || !$authStore.user) return;

		try {
			const messagesResponse = await fetchMessagesPaginated(token, chatId, 50);
			const reversedMessages = messagesResponse.messages.reverse();

			const messageIds = reversedMessages.map(m => m.id);
			const reactionsByMessage = await fetchMultipleMessageReactions(token, chatId, messageIds);

			const memberMapping: { [userId: string]: string } = {};
			for (const member of data.chat.members) {
				memberMapping[member.id] = member.name;
			}

			const messagesWithReactions = mergeMessagesWithPerMessageReactions(
				reversedMessages,
				reactionsByMessage,
				memberMapping
			);

			const existingIds = new Set(messages.map(m => m.id));
			const newMessages = messagesWithReactions.filter(m => !existingIds.has(m.id));

			if (newMessages.length > 0) {
				messages = [...messages, ...newMessages];
				prevCursor = messagesResponse.prevCursor;
				cleanupMessages();
				if (shouldAutoScroll) {
					scrollToBottom();
				}
			}
		} catch (err) {
			console.warn('Failed to refresh messages on focus:', err);
		}
	}

	// Optimistically update a specific message's reactions without refreshing all messages
	// Handles adding, removing, or changing user's reaction to a message
	async function updateMessageReaction(messageId: string, reactionType?: 'FUNNY' | 'LIKE' | 'LOVE') {
		const token = $authStore.token;
		const user = $authStore.user;
		if (!token || !user) return;

		// Find the message index
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		const currentMessage = messages[messageIndex];
		const currentUserReaction = getUserReactionForMessage(currentMessage, user.id);

		// Create optimistic update
		let newReactions: ReactionSummary[] = [...(currentMessage.reactions || [])];

		if (currentUserReaction) {
			newReactions = newReactions.map(reaction => {
				if (reaction.type === currentUserReaction) {
					const updatedUsers = reaction.users.filter(u => u.userId !== user.id);
					return {
						...reaction,
						count: updatedUsers.length,
						users: updatedUsers
					};
				}
				return reaction;
			}).filter(reaction => reaction.count > 0);
		}

		if (reactionType && reactionType !== currentUserReaction) {
			const existingReactionIndex = newReactions.findIndex(r => r.type === reactionType);
			if (existingReactionIndex >= 0) {
				const existingReaction = newReactions[existingReactionIndex];
				if (!existingReaction.users.some(u => u.userId === user.id)) {
					newReactions[existingReactionIndex] = {
						...existingReaction,
						count: existingReaction.count + 1,
						users: [...existingReaction.users, {
							userId: user.id,
							username: user.username || 'You'
						}]
					};
				}
			} else {
				newReactions.push({
					type: reactionType,
					count: 1,
					users: [{
						userId: user.id,
						username: user.username || 'You'
					}]
				});
			}
		}

		messages[messageIndex] = {
			...currentMessage,
			reactions: newReactions
		};

		try {
			await reactToMessage(token, chatId, messageId, reactionType);
			refreshReactions();
		} catch (error) {
			console.error('Failed to react to message:', error);
			refreshReactions();
		}
	}

	// Start periodic reaction polling when chat is active
	function startReactionPolling() {
		if (reactionPollingInterval) return; // Already running

		reactionPollingInterval = setInterval(() => {
			if (windowFocused && !document.hidden) {
				refreshReactions();
			}
		}, REACTION_POLLING_INTERVAL_MS);
	}

	// Stop periodic reaction polling
	function stopReactionPolling() {
		if (reactionPollingInterval) {
			clearInterval(reactionPollingInterval);
			reactionPollingInterval = null;
		}
	}

	// Refresh only reactions without reloading messages - more efficient for real-time updates
	async function refreshReactions() {
		const token = $authStore.token;
		if (!token || messages.length === 0) return;

		try {
			const messageIds = messages.map(m => m.id);
			const reactionsByMessage = await fetchMultipleMessageReactions(token, chatId, messageIds);

			const memberMapping: { [userId: string]: string } = {};
			for (const member of data.chat.members) {
				memberMapping[member.id] = member.name;
			}

			messages = mergeMessagesWithPerMessageReactions(messages, reactionsByMessage, memberMapping);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : '';
			if (errMsg.includes('401') || errMsg.includes('403')) {
				stopReactionPolling();
				return;
			}
			console.warn('Failed to refresh reactions:', error);
		}
	}

	async function loadFavoriteMessages() {
		const token = $authStore.token;
		if (!token) return;

		try {
			const favorites = await fetchFavoriteMessages(token, chatId);
			const favoriteIds = favorites.map(fav => fav.messageId);
			favoriteMessageIds = new Set(favoriteIds);
		} catch (err) {
			console.error('Failed to load favorite messages:', err);
		}
	}

	async function loadMoreMessages() {
		const token = $authStore.token;
		if (!token || !nextCursor || isLoadingMore) return;

		isLoadingMore = true;
		shouldAutoScroll = false;

		try {
			const response: PagedMessageResponse = await fetchMessagesPaginated(
				token,
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


	function goBack() {
		disconnectWebSocket();
		goto('/');
	}

	async function handleSendMessage() {
		const token = $authStore.token;
		if (!token || (!newMessage.trim() && selectedImages.length === 0)) return;

		const messageText = newMessage.trim();
		const imagesToUpload = [...selectedImages];
		const replyToMessage = replyingTo;

		newMessage = '';
		selectedImages = [];
		replyingTo = null;
		showImageUpload = false;
		sendError = null;
		isSending = true;
		isUploadingImages = imagesToUpload.length > 0;
		selectedMessageIndex = -1;

		try {
			let imageIds: string[] = [];

			if (imagesToUpload.length > 0) {
				const uploadPromises = imagesToUpload.map(file =>
					uploadImage(token, file)
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

			await sendMessage(token, chatId, { message: finalMessageContent });

			try {
				const chats = await apiFetchChats(token);
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
		if (showEmojiAutocomplete) {
			const results = searchEmojis(emojiQuery);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				emojiAutocompleteIndex = Math.min(emojiAutocompleteIndex + 1, results.length - 1);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				emojiAutocompleteIndex = Math.max(emojiAutocompleteIndex - 1, 0);
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				if (results.length > 0) {
					e.preventDefault();
					insertEmojiFromAutocomplete(results[emojiAutocompleteIndex].code);
					return;
				}
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showEmojiAutocomplete = false;
				return;
			}
		}

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

	function handleMessageInput() {
		if (!messageInputElement) return;
		const value = messageInputElement.value;
		const cursorPos = messageInputElement.selectionStart || 0;
		const textBeforeCursor = value.slice(0, cursorPos);

		const colonMatch = textBeforeCursor.match(/:([a-zA-Z]{1,})$/);
		if (colonMatch) {
			emojiQuery = colonMatch[0];
			const results = searchEmojis(emojiQuery);
			showEmojiAutocomplete = results.length > 0;
			emojiAutocompleteIndex = 0;
		} else {
			showEmojiAutocomplete = false;
		}
	}

	function insertEmojiFromAutocomplete(code: string) {
		if (!messageInputElement) return;
		const value = messageInputElement.value;
		const cursorPos = messageInputElement.selectionStart || 0;
		const textBeforeCursor = value.slice(0, cursorPos);

		const colonMatch = textBeforeCursor.match(/:([a-zA-Z]*)$/);
		if (colonMatch) {
			const start = cursorPos - colonMatch[0].length;
			const after = value.slice(cursorPos);
			newMessage = value.slice(0, start) + code + ' ' + after;
			showEmojiAutocomplete = false;

			setTimeout(() => {
				if (messageInputElement) {
					const newPos = start + code.length + 1;
					messageInputElement.selectionStart = newPos;
					messageInputElement.selectionEnd = newPos;
					messageInputElement.focus();
				}
			}, 0);
		}
	}

	function insertEmojiFromPicker(code: string) {
		if (!messageInputElement) {
			newMessage += code;
			return;
		}
		const cursorPos = messageInputElement.selectionStart || newMessage.length;
		const before = newMessage.slice(0, cursorPos);
		const after = newMessage.slice(cursorPos);
		newMessage = before + code + ' ' + after;
		showEmojiPicker = false;

		setTimeout(() => {
			if (messageInputElement) {
				const newPos = cursorPos + code.length + 1;
				messageInputElement.selectionStart = newPos;
				messageInputElement.selectionEnd = newPos;
				messageInputElement.focus();
			}
		}, 0);
	}

	$effect(() => {
		if (!showEmojiPicker) return;

		function handleEmojiPickerOutsideClick(event: MouseEvent) {
			const target = event.target as Element;
			if (!target.closest('.emoji-picker') && !target.closest('.emoji-btn')) {
				showEmojiPicker = false;
			}
		}

		document.addEventListener('click', handleEmojiPickerOutsideClick);
		return () => document.removeEventListener('click', handleEmojiPickerOutsideClick);
	});

	async function handleDeleteMessage(messageId: string) {
		const token = $authStore.token;
		if (!token) return;

		try {
			await deleteMessage(token, chatId, messageId);
			messages = messages.map(msg =>
				msg.id === messageId
					? { ...msg, message: '[deleted message]' }
					: msg
			);
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
		const token = $authStore.token;
		if (!token) return;

		try {
			await toggleMessageFavorite(token, chatId, messageId);
			if (favoriteMessageIds.has(messageId)) {
				favoriteMessageIds.delete(messageId);
			} else {
				favoriteMessageIds.add(messageId);
			}
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
		const token = $authStore.token;
		if (!token) return;

		isCreatingInvite = true;
		inviteError = null;
		inviteCode = null;

		try {
			const invitation = await createInvitation(token, chatId);
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

	let inviteCopied = $state(false);

	function copyInviteCode() {
		if (inviteCode) {
			navigator.clipboard.writeText(inviteCode);
			inviteCopied = true;
			setTimeout(() => { inviteCopied = false; }, 2000);
		}
	}

	async function jumpToNewest() {
		shouldAutoScroll = true;
		showJumpToNewest = false;
		isInitialScroll = false; // Reset initial scroll flag
		scrollToBottom();

		const token = $authStore.token;
		if (token) {
			try {
				const chats = await apiFetchChats(token);
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
		const token = $authStore.token;
		if (!token) return;

		const success = await deleteChat(token, chatId);
		if (success) {
			showDeleteModal = false;
			goto('/');
		}
	}

	async function handleLeaveChat() {
		const token = await getValidToken();
		const userId = $authStore.user?.id;
		if (!token || !userId) return;

		isLeaving = true;
		try {
			await leaveChat(token, chatId, userId);
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

	async function confirmAndOpenLink() {
		if (pendingUrl) {
			try {
				if ('__TAURI_INTERNALS__' in window) {
					const { openUrl } = await import('@tauri-apps/plugin-opener');
					await openUrl(pendingUrl);
				} else {
					window.open(pendingUrl, '_blank', 'noopener,noreferrer');
				}
			} catch (error) {
				// Without this, a failure here (e.g. a permission/scope
				// issue in the packaged app) throws inside an async click
				// handler - the promise rejection is unhandled, so the
				// modal never closes and nothing visibly happens.
				console.error('Failed to open link:', error);
				linkOpenError = 'Could not open this link. Please try again.';
				closeLinkConfirmation();
				return;
			}
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
		const viewport = window.visualViewport;
		if (!viewport) return;

		function handleViewportResize() {
			const page = document.querySelector('.chat-page') as HTMLElement;
			if (!page) return;
			page.style.height = `${viewport!.height}px`;
			page.style.transform = `translateY(${viewport!.offsetTop}px)`;
			if (shouldAutoScroll) {
				scrollToBottom();
			}
		}

		viewport.addEventListener('resize', handleViewportResize);
		viewport.addEventListener('scroll', handleViewportResize);
		return () => {
			viewport.removeEventListener('resize', handleViewportResize);
			viewport.removeEventListener('scroll', handleViewportResize);
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
					<DropdownMenu width="180px">
						{#snippet trigger({ toggle })}
							<button
								onclick={toggle}
								class="btn btn-ghost actions-toggle"
								disabled={$chatStore.isDeleting}
								type="button"
							>
								⋮
							</button>
						{/snippet}
						{#snippet children({ close })}
							<button
								onclick={() => {
									chatMuteStore.toggleMute(data.chatId);
									close();
								}}
								class="dropdown-item"
								type="button"
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
										close();
									}}
									class="dropdown-item danger"
									disabled={isLeaving}
									type="button"
								>
									{isLeaving ? 'Leaving...' : 'Leave Chat'}
								</button>
							{/if}
							{#if isOwner}
								<button
									onclick={() => {
										showDeleteModal = true;
										close();
									}}
									class="dropdown-item danger"
									disabled={$chatStore.isDeleting}
									type="button"
								>
									{$chatStore.isDeleting ? 'Deleting...' : 'Delete Chat'}
								</button>
							{/if}
						{/snippet}
					</DropdownMenu>
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
					<LoadingSpinner label="Loading messages..." />
				</div>
			{:else if messages.length === 0}
				<div class="empty-messages">
					<EmptyState icon="💬" title="No messages yet" description="Be the first to start the conversation!" />
				</div>
			{:else}
				<div class="messages-container">
					<!-- Auto-loading indicator -->
					{#if hasMoreMessages && isLoadingMore}
						<div class="loading-more-container">
							<LoadingSpinner size="sm" inline label="Loading older messages..." />
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
												<div class="mobile-menu-backdrop" onclick={closeActionMenu}></div>
												<div class="action-dropdown">
													<div class="sheet-reactions">
														<button class="sheet-reaction-btn"
														        class:active={message.reactions?.some(r => r.type === 'FUNNY' && r.users.some(u => u.userId === $authStore.user?.id))}
														        onclick={() => { updateMessageReaction(message.id, 'FUNNY'); closeActionMenu(); }}>
															😂
														</button>
														<button class="sheet-reaction-btn"
														        class:active={message.reactions?.some(r => r.type === 'LIKE' && r.users.some(u => u.userId === $authStore.user?.id))}
														        onclick={() => { updateMessageReaction(message.id, 'LIKE'); closeActionMenu(); }}>
															👍
														</button>
														<button class="sheet-reaction-btn"
														        class:active={message.reactions?.some(r => r.type === 'LOVE' && r.users.some(u => u.userId === $authStore.user?.id))}
														        onclick={() => { updateMessageReaction(message.id, 'LOVE'); closeActionMenu(); }}>
															❤️
														</button>
													</div>
													<button class="dropdown-item reply-item"
													        onclick={() => handleReplyToMessage(message)}>
														<span class="desktop-text">↩ Reply</span>
														<span class="mobile-text">Reply</span>
													</button>
													<button class="dropdown-item favorite-item"
													        onclick={() => handleToggleFavorite(message.id)}>
														<span class="desktop-text">{favoriteMessageIds.has(message.id) ? '★ Unfavorite' : '☆ Favorite'}</span>
														<span class="mobile-text">{favoriteMessageIds.has(message.id) ? 'Unfavorite' : 'Favorite'}</span>
													</button>
													{#if isOwnMessage}
														<button class="dropdown-item delete-item"
														        onclick={() => handleDeleteMessage(message.id)}>
															<span class="desktop-text">✕ Delete</span>
															<span class="mobile-text">Delete</span>
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

								<!-- Message reactions -->
								{#if message.message !== '[deleted message]'}
									<MessageReactions
										{message}
										{isOwnMessage}
										onReactionChange={(reactionType) => updateMessageReaction(message.id, reactionType)}
									/>
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
				<div class="textarea-wrapper">
					{#if showEmojiAutocomplete}
						<EmojiAutocomplete
							query={emojiQuery}
							onSelect={insertEmojiFromAutocomplete}
							selectedIndex={emojiAutocompleteIndex}
						/>
					{/if}
					{#if showEmojiPicker}
						<EmojiPicker
							onSelect={insertEmojiFromPicker}
							onClose={() => showEmojiPicker = false}
						/>
					{/if}
					<textarea
						rows="1"
						bind:value={newMessage}
						bind:this={messageInputElement}
						onkeydown={handleKeyPress}
						oninput={handleMessageInput}
						onfocus={() => {
							selectedMessageIndex = -1;
							setTimeout(() => scrollToBottom(), 300);
						}}
						placeholder={selectedImages.length > 0 ? 'Add a caption...' : 'Type a message...'}
						disabled={isSending || isUploadingImages}
						class="message-input"
					></textarea>
				</div>
				<button
					type="button"
					class="btn btn-secondary emoji-btn"
					onclick={() => showEmojiPicker = !showEmojiPicker}
					disabled={isSending || isUploadingImages}
					title="Emojis"
				>
					☺
				</button>
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
			<Modal title="Invitation Created!" onClose={closeInviteModal}>
				<p class="modal-description">Share this invitation code with others to join the chat:</p>
				<div class="invite-code-display">
					<span class="invite-code">{inviteCode}</span>
					<button onclick={copyInviteCode} class="btn btn-ghost copy-btn" class:copied={inviteCopied}>
						{inviteCopied ? 'Copied!' : 'Copy'}
					</button>
				</div>
				<p class="invite-note">This code can be used once to join the chat.</p>
			</Modal>
		{/if}

		<!-- Delete Confirmation Modal -->
		{#if showDeleteModal}
			<Modal title="Delete Chat" onClose={() => showDeleteModal = false}>
				<p class="modal-description"><strong>Are you sure you want to delete this chat?</strong></p>
				<p class="modal-description">This action cannot be undone. The chat "#{chatName}" and all its messages will be permanently deleted.</p>
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
			</Modal>
		{/if}

		<!-- Leave Confirmation Modal -->
		{#if showLeaveModal}
			<Modal title="Leave Chat" onClose={() => showLeaveModal = false}>
				<p class="modal-description"><strong>Are you sure you want to leave this chat?</strong></p>
				<p class="modal-description">You will no longer receive messages from "#{chatName}" and will need to be re-invited to join again.</p>
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
			</Modal>
		{/if}

		<!-- Invitation Error -->
		{#if inviteError}
			<Toast message={inviteError} onDismiss={() => inviteError = null} />
		{/if}

		<!-- Link Confirmation Modal -->
		{#if showLinkConfirmation && pendingUrl}
			<Modal title="Open Link" onClose={closeLinkConfirmation}>
				<p class="modal-description">Do you want to open this link in a new tab?</p>
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
			</Modal>
		{/if}

		<!-- Chat Error (for delete operations) -->
		{#if $chatStore.error}
			<Toast message={$chatStore.error} onDismiss={() => chatStore.update(state => ({ ...state, error: null }))} />
		{/if}

		<!-- Link Open Error -->
		{#if linkOpenError}
			<Toast message={linkOpenError} onDismiss={() => linkOpenError = null} />
		{/if}
	</div>
{:else}
	<div class="loading-screen">
		<LoadingSpinner size="lg" label="Loading..." />
	</div>
{/if}

<style>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: var(--bg-primary);
		padding-top: env(safe-area-inset-top);
		overflow: hidden;
	}

	/* Header */
	.chat-header {
		background: var(--bg-primary);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.header-content {
		max-width: 900px;
		margin: 0 auto;
		padding: 0.75rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.chat-logo {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	.back-btn {
		padding: 0.375rem 0.625rem;
		font-size: 0.875rem;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Chat Content */
	.chat-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.5rem;
		max-width: 900px;
		margin: 0 auto;
		width: 100%;
		position: relative;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
	}

	.empty-messages {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: var(--text-muted);
	}

	/* Messages */
	.messages-container {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0;
	}

	/* Auto-loading indicator */
	.loading-more-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.message-item {
		border-radius: var(--radius-lg);
		padding: 0.625rem 0.875rem;
		max-width: 70%;
		margin-bottom: 0.125rem;
		transition: background-color 0.15s ease;
		position: relative;
	}

	@keyframes highlightPulse {
		0% {
			background: var(--accent-subtle);
			box-shadow: 0 0 0 3px var(--accent-subtle);
		}
		100% {
			background: transparent;
			box-shadow: none;
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
		border-left: 2px solid #f59e0b;
	}

	.message-item.favorited.own-message {
		border-right: 2px solid #f59e0b;
		border-left: none;
	}

	.own-message {
		background: var(--accent);
		color: white;
		align-self: flex-end;
		border-bottom-right-radius: 4px;
	}

	.other-message {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-left: 3px solid var(--current-member-color, var(--border-color));
		align-self: flex-start;
		border-bottom-left-radius: 4px;
	}

	:global([data-theme='dark']) .other-message {
		background: var(--bg-glass);
		border-color: var(--glass-border);
	}

	:global([data-theme='dark']) .own-message {
		background: rgba(99, 102, 241, 0.08);
		color: var(--text-primary);
		border: 1px solid rgba(99, 102, 241, 0.15);
	}

	:global([data-theme='dark']) .own-message .message-user {
		color: #818cf8;
	}

	:global([data-theme='dark']) .own-message .message-time {
		color: var(--text-muted);
	}

	:global([data-theme='dark']) .own-message .message-content {
		color: var(--text-primary);
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.125rem;
		gap: 0.5rem;
	}

	.message-user {
		font-weight: 600;
		color: var(--current-member-color, var(--accent));
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.favorite-indicator {
		color: #f59e0b;
		font-size: 0.7rem;
		display: inline-block;
		margin-left: 0.125rem;
	}

	.message-header-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.message-time {
		color: var(--text-muted);
		font-size: 0.6875rem;
		white-space: nowrap;
	}

	.message-content {
		position: relative;
		color: var(--text-primary);
		line-height: 1.5;
		font-size: 0.9375rem;
		word-wrap: break-word;
		white-space: pre-line;
		overflow-wrap: break-word;
	}

	.message-previews {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	/* Message actions menu */
	.message-actions {
		opacity: 0;
		position: absolute;
		top: -2px;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		transition: opacity 0.15s ease;
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

	@media (hover: none) {
		.message-actions {
			opacity: 0.6;
		}
	}

	.action-btn {
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.25rem;
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.1s ease;
	}

	.action-btn:hover {
		background: var(--bg-tertiary);
	}

	.menu-btn {
		font-weight: bold;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.menu-btn:hover {
		color: var(--text-primary);
	}

	/* Action dropdown menu */
	.action-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 16px var(--shadow-elevated);
		z-index: 1000;
		min-width: 120px;
		margin-top: 4px;
		padding: 0.25rem;
		animation: fadeInDropdown 0.1s ease-out;
	}

	@keyframes fadeInDropdown {
		from {
			opacity: 0;
			transform: translateY(-2px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0.4rem 0.625rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--text-primary);
		transition: background-color 0.1s ease;
		border-radius: var(--radius-sm);
	}

	.dropdown-item:hover {
		background: var(--bg-secondary);
	}

	.delete-item {
		color: var(--danger);
	}

	.delete-item:hover {
		background: rgba(239, 68, 68, 0.08);
	}

	.reply-item {
		color: var(--accent);
	}

	.reply-item:hover {
		background: var(--accent-subtle);
	}

	.favorite-item {
		color: #f59e0b;
	}

	.favorite-item:hover {
		background: rgba(245, 158, 11, 0.08);
	}

	/* Position menu on left for other messages */
	.other-message .action-dropdown {
		right: auto;
		left: 0;
	}

	/* Reaction row in bottom sheet - hidden on desktop */
	.sheet-reactions {
		display: none;
	}

	/* Mobile menu backdrop - hidden on desktop */
	.mobile-menu-backdrop {
		display: none;
	}

	/* Text visibility control */
	.desktop-text {
		display: inline;
	}

	.mobile-text {
		display: none;
	}

	/* Own message styling overrides */
	.own-message .message-user {
		color: rgba(255, 255, 255, 0.85);
	}

	.own-message .message-time {
		color: rgba(255, 255, 255, 0.6);
	}

	.own-message .message-content {
		color: white;
	}

	/* Link styling in messages */
	.message-content :global(.message-link) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
		word-break: break-all;
		transition: color 0.1s ease;
	}

	.message-content :global(.message-link):hover {
		color: var(--accent-hover);
	}

	/* Link styling in own messages */
	.own-message .message-content :global(.message-link) {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: underline;
	}

	.own-message .message-content :global(.message-link):hover {
		color: white;
	}

	/* Message Input */
	.message-input-area {
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		padding: 0.75rem 1.5rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
		flex-shrink: 0;
	}

	.send-error {
		max-width: 900px;
		margin: 0 auto 0.75rem auto;
	}

	.reply-composition-container {
		max-width: 900px;
		margin: 0 auto 0.5rem auto;
	}

	.input-container {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.input-container .btn {
		height: 40px;
		padding: 0 1rem;
		font-size: 0.8125rem;
	}

	.image-upload-section {
		max-width: 900px;
		margin: 0 auto 0.75rem auto;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		padding: 0.75rem;
	}

	.image-btn {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		padding: 0;
		background: var(--bg-secondary);
		border: 1.5px solid var(--border-color);
		color: var(--text-secondary);
		transition: all 0.15s ease;
		box-sizing: border-box;
	}

	.image-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.image-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.emoji-btn {
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
		border: 1.5px solid var(--border-color);
		color: var(--text-secondary);
		transition: all 0.15s ease;
		box-sizing: border-box;
	}

	.emoji-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.emoji-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.textarea-wrapper {
		position: relative;
		flex: 1;
	}

	.message-gifs {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 6px;
	}

	.message-input {
		width: 100%;
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-color);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9375rem;
		resize: none;
		overflow-y: auto;
		height: 40px;
		min-height: 40px;
		max-height: 120px;
		line-height: 1.5;
		scrollbar-width: none;
		-ms-overflow-style: none;
		box-sizing: border-box;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.message-input::-webkit-scrollbar {
		display: none;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-subtle);
		background: var(--bg-primary);
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-muted);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.header-content {
			padding: 0.625rem 1rem;
		}

		.header-left {
			gap: 0.5rem;
		}

		.back-btn {
			padding: 0.375rem 0.5rem;
			font-size: 0.8rem;
		}

		.chat-title {
			gap: 0.25rem;
		}

		.chat-logo {
			width: 18px;
			height: 18px;
		}

		.header-content h1 {
			font-size: 1rem;
		}

		.message-item {
			max-width: 85%;
		}

		.message-header {
			gap: 0.375rem;
		}

		/* Touch-friendly action buttons */
		.action-btn {
			width: 32px;
			height: 32px;
			padding: 0.5rem;
		}

		.menu-btn {
			font-size: 1rem;
		}

		/* Switch to mobile text */
		.desktop-text {
			display: none;
		}

		.mobile-text {
			display: inline;
		}

		/* Bottom sheet backdrop */
		.mobile-menu-backdrop {
			display: block;
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background: rgba(15, 23, 42, 0.4);
			backdrop-filter: blur(2px);
			z-index: 9998;
			animation: fadeIn 0.15s ease-out;
		}

		@keyframes fadeIn {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		/* Bottom sheet action menu */
		.action-dropdown {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			top: auto;
			z-index: 9999;
			min-width: 100%;
			max-width: 100%;
			margin-top: 0;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			box-shadow: 0 -4px 24px var(--shadow-elevated);
			padding: 0.25rem;
			padding-bottom: env(safe-area-inset-bottom);
			animation: slideUp 0.2s ease-out;
		}

		.own-message .action-dropdown,
		.other-message .action-dropdown {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			top: auto;
		}

		@keyframes slideUp {
			from { transform: translateY(100%); }
			to { transform: translateY(0); }
		}

		.action-dropdown .dropdown-item {
			padding: 0.875rem 1.25rem;
			font-size: 0.9375rem;
			min-height: 48px;
			display: flex;
			align-items: center;
			justify-content: center;
			text-align: center;
			border-bottom: 1px solid var(--border-color);
			border-radius: 0;
		}

		.action-dropdown .dropdown-item:first-child {
			border-radius: var(--radius-md) var(--radius-md) 0 0;
		}

		.action-dropdown .dropdown-item:last-child {
			border-bottom: none;
			border-radius: 0 0 var(--radius-md) var(--radius-md);
		}

		/* Reaction row in bottom sheet */
		.sheet-reactions {
			display: flex;
			justify-content: center;
			gap: 0.75rem;
			padding: 1rem;
			border-bottom: 1px solid var(--border-color);
		}

		.sheet-reaction-btn {
			width: 44px;
			height: 44px;
			border-radius: 50%;
			border: 1.5px solid var(--border-color);
			background: var(--bg-secondary);
			font-size: 1.25rem;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.15s ease;
		}

		.sheet-reaction-btn:active {
			transform: scale(0.9);
		}

		.sheet-reaction-btn.active {
			border-color: var(--accent);
			background: var(--accent-subtle);
			box-shadow: 0 0 0 2px var(--accent-subtle);
		}
	}

	@media (max-width: 480px) {
		.chat-content {
			padding: 0.5rem 0.75rem;
		}

		.message-input-area {
			padding: 0.5rem 0.75rem;
			padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
		}

		.input-container {
			gap: 0.375rem;
		}

		.image-upload-section {
			padding: 0.625rem;
		}

		.image-btn,
		.emoji-btn {
			width: 36px;
			height: 36px;
			font-size: 13px;
		}

		.input-container .btn {
			height: 36px;
			padding: 0 0.75rem;
			font-size: 0.75rem;
		}

		.message-input {
			height: 36px;
			min-height: 36px;
			font-size: 0.875rem;
		}

		.message-item {
			max-width: 90%;
			padding: 0.5rem 0.75rem;
		}

		.own-message {
			margin-left: auto;
		}

		.other-message {
			margin-right: auto;
		}

		.message-time {
			font-size: 0.625rem;
		}

		.action-btn {
			width: 34px;
			height: 34px;
		}
	}

	/* Very small screens - truncate group name */
	@media (max-width: 428px) {
		.header-content h1 {
			max-width: 14ch;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	/* Invitation Button */
	.invite-btn {
		font-size: 0.8125rem;
		padding: 0.375rem 0.5rem;
		line-height: 1;
	}

	/* Chat header's "..." actions menu is now the shared DropdownMenu
	   component; the delete/leave/link-confirm modals are now the shared
	   Modal component. The rules below only style content this page
	   passes into those components. */
	.actions-toggle {
		font-size: 1rem;
		padding: 0.375rem 0.5rem;
		font-weight: bold;
		line-height: 1;
	}

	.modal-description {
		margin: 0 0 0.75rem 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.invite-code-display {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 1rem 0;
		padding: 0.875rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
	}

	.invite-code {
		flex: 1;
		font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--accent);
		text-align: center;
		letter-spacing: 1px;
	}

	.copy-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		flex-shrink: 0;
		transition: color 0.15s, background 0.15s;
	}

	.copy-btn.copied {
		color: var(--success, #10b981);
	}

	.invite-note {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
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

	/* Link confirmation modal styles */
	.link-display {
		margin: 0.75rem 0;
		padding: 0.875rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		word-break: break-all;
	}

	.link-url {
		font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
		font-size: 0.8rem;
		color: var(--accent);
		display: block;
		text-align: center;
	}

	.link-warning {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
		font-style: italic;
	}

	/* Error Toast */
	/* Jump to Newest Button */
	.jump-to-newest-btn {
		position: sticky;
		bottom: 0.75rem;
		align-self: center;
		margin-left: auto;
		margin-right: auto;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 20px;
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		z-index: 100;
		box-shadow: 0 2px 8px var(--shadow-hover);
		transition: all 0.15s ease;
		animation: slideInUp 0.2s ease-out;
	}

	.jump-to-newest-btn:hover {
		background: var(--accent-hover);
		box-shadow: 0 4px 12px var(--shadow-elevated);
	}

	.jump-to-newest-btn:active {
		transform: scale(0.97);
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.jump-to-newest-btn {
			padding: 0.4rem 0.875rem;
			font-size: 0.75rem;
		}
	}
</style>
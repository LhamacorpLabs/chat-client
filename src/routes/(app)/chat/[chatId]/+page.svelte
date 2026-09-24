<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { authStore, getValidToken } from '$lib/stores/auth';
	import { chatStore, deleteChat } from '$lib/stores/chat';
	import { mqttService } from '$lib/stores/mqtt';
	import { fetchMessagesPaginated, sendMessage, createInvitation, fetchChats as apiFetchChats, deleteMessage, leaveChat, uploadImage, toggleMessageFavorite, fetchFavoriteMessages, reactToMessage, fetchMultipleMessageReactions } from '$lib/api/chat';
	import type { Message, Chat, PagedMessageResponse } from '$lib/types/chat';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import ParsedMessage from '$lib/components/ParsedMessage.svelte';
	import MessageGif from '$lib/components/MessageGif.svelte';
	import MessageReactions from '$lib/components/MessageReactions.svelte';
	import { hasImages } from '$lib/utils/imageMessages';
	import {
		assignColorsForChat,
		addMemberColor,
		getMemberColor,
		shouldUseMemberColors,
		loadMemberColors
	} from '$lib/stores/memberColors';
	import { linkify } from '$lib/utils/linkify';
	import LinkifiedText from '$lib/components/LinkifiedText.svelte';
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
	import { colorForChat } from '$lib/utils/chatAvatar';
	import { formatTime, formatFullDateTime, formatDayLabel, isSameDay } from '$lib/utils/time';
	import { PUBLIC_REALTIME_MODE } from '$env/static/public';
	import { mergeMessagesWithPerMessageReactions, messagesReactionsChanged, getUserReactionForMessage } from '$lib/utils/reactionUtils';
	import type { ReactionSummary, ReactionType } from '$lib/types/chat';
	import Modal from '$lib/components/ui/Modal.svelte';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	// Realtime mode: 'mqtt' or 'polling'
	const realtimeMode = PUBLIC_REALTIME_MODE || 'mqtt';

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

	let mqttUnsubscribe: (() => void) | null = null;
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	const POLLING_INTERVAL_MS = 1000;
	let reactionPollingInterval: ReturnType<typeof setInterval> | null = null;
	const REACTION_POLLING_INTERVAL_MS = 10000; // Poll reactions every 10 seconds
	let messageInputElement = $state<HTMLTextAreaElement>(undefined!);
	let chatContent = $state<HTMLElement>(undefined!);
	// The content that actually grows (messages, images, reactions) - as
	// opposed to chatContent, the fixed-height viewport that scrolls it.
	let messagesContainer = $state<HTMLElement | undefined>(undefined);
	let windowFocused = $state(true);
	let hasUnreadMessages = $state(false);

	let nextCursor = $state<string | null>(null);
	let prevCursor = $state<string | null>(null);
	let hasMoreMessages = $state(false);
	let isLoadingMore = $state(false);

	// Whether the user is viewing the bottom of the thread. Only justifies
	// scrolling for a message that arrives while it's true (see
	// wasAtBottom) - background updates (reactions, images, others'
	// content resizing) just update this flag, never the scroll position.
	let isPinnedToBottom = $state(true);
	const showJumpToNewest = $derived(!isPinnedToBottom);
	let isUserScrolling = $state(false);

	// Messages that arrived while scrolled away from the bottom, so they
	// didn't auto-follow. Drives the jump-to-newest button's unread badge;
	// reset once the user is back at the bottom, however they got there.
	let newMessagesBelowCount = $state(0);

	// Not reactive on purpose: read/written only by scroll handling code,
	// to tell handleScroll() a 'scroll' event was caused by our own code
	// (scrollToBottom, restoring position) rather than the user.
	let isProgrammaticScroll = false;

	const BOTTOM_THRESHOLD_PX = 200; // how close to the bottom still counts as "pinned"
	const LOAD_MORE_THRESHOLD_PX = 100; // how close to the top triggers pagination
	const USER_SCROLL_SETTLE_MS = 150; // pause auto-scroll this long after the user scrolls
	const SCROLL_SETTLE_EPSILON_PX = 2; // treat this close to a target as "already there"
	const RENDER_SETTLE_DELAY_MS = 100; // let newly-rendered messages paint before measuring
	const FOCUS_SCROLL_DELAY_MS = 300; // let the on-screen keyboard/viewport settle first

	let shouldUseColors = $state(false);

	let replyingTo = $state<Message | null>(null);
	let highlightedMessageId = $state<string | null>(null);
	let selectedMessageIndex = $state(-1);

	// Track favorited messages locally
	let favoriteMessageIds = new SvelteSet<string>();

	const chatId = $derived(data.chatId);
	const currentChat = $derived(data.chat);
	const chatName = $derived(currentChat.name);
	const isOwner = $derived(data.isOwner);

	const quickReactions: { type: ReactionType; emoji: string; label: string }[] = [
		{ type: 'LIKE', emoji: '👍', label: 'Like' },
		{ type: 'LOVE', emoji: '❤️', label: 'Love' },
		{ type: 'FUNNY', emoji: '😂', label: 'Haha' }
	];

	// Consecutive messages from the same author within this window render
	// as one visual group (one avatar/name header, tightened bubble
	// corners), and a divider is inserted whenever the calendar day changes.
	const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

	function continuesGroup(prev: Message | undefined, next: Message | undefined): boolean {
		if (!prev || !next || prev.username !== next.username) return false;
		if (!isSameDay(prev.createdAt, next.createdAt)) return false;
		const gap = new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime();
		return Math.abs(gap) < MESSAGE_GROUP_WINDOW_MS;
	}

	const messageLayout = $derived(
		messages.map((message, i) => ({
			newDay: i === 0 || !isSameDay(messages[i - 1].createdAt, message.createdAt),
			first: !continuesGroup(messages[i - 1], message),
			last: !continuesGroup(message, messages[i + 1])
		}))
	);

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

			// Use MQTT or polling based on realtime mode
			if (realtimeMode === 'mqtt') {
				connectMqtt();
			} else {
				startPolling();
			}
		}

		return () => {
			if (realtimeMode === 'mqtt') {
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

	function distanceFromBottom(el: HTMLElement) {
		return el.scrollHeight - el.clientHeight - el.scrollTop;
	}

	// Checked right before new content is appended, to decide if it's
	// allowed to pull the view down. Tighter than BOTTOM_THRESHOLD_PX
	// (which just hides the jump button) - auto-following from 150px away
	// would be the same unwanted yank this was built to avoid.
	function wasAtBottom() {
		return !!chatContent && distanceFromBottom(chatContent) <= SCROLL_SETTLE_EPSILON_PX;
	}

	// Call right before a synchronous scrollTop assignment so the 'scroll'
	// event(s) it causes are ignored by handleScroll() instead of being
	// mistaken for user input.
	function markProgrammaticScroll() {
		isProgrammaticScroll = true;
		requestAnimationFrame(() => {
			isProgrammaticScroll = false;
		});
	}

	function scrollToBottom() {
		if (!chatContent) return;
		setTimeout(() => {
			if (!chatContent) return;

			// Skip if already effectively at the bottom - on fractional-DPI
			// displays (common on Windows) distanceFromBottom never quite
			// settles at exactly 0, so reassigning every time would loop
			// scroll events with handleScroll via markProgrammaticScroll.
			if (Math.abs(distanceFromBottom(chatContent)) < SCROLL_SETTLE_EPSILON_PX) return;

			markProgrammaticScroll();
			chatContent.scrollTop = chatContent.scrollHeight;
		}, 0);
	}

	function scrollToMessage(messageIndex: number) {
		if (chatContent && messageIndex >= 0 && messageIndex < messages.length) {
			setTimeout(() => {
				const messageElements = chatContent.querySelectorAll('.message-item');
				messageElements[messageIndex]?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			}, RENDER_SETTLE_DELAY_MS);
		}
	}

	$effect(() => {
		if (!chatContent) return;

		let userScrollTimeout: ReturnType<typeof setTimeout>;
		let lastScrollTop = chatContent.scrollTop;

		function handleScroll() {
			if (!chatContent) return;

			// Windows mouse wheel notches are small enough to stay inside
			// BOTTOM_THRESHOLD_PX for several ticks, so judging "pinned" by
			// distance alone left Windows users pinned mid-gesture. Track
			// direction instead - any upward movement unpins immediately.
			const currentScrollTop = chatContent.scrollTop;
			const scrolledUp = currentScrollTop < lastScrollTop - SCROLL_SETTLE_EPSILON_PX;
			lastScrollTop = currentScrollTop;

			if (isProgrammaticScroll) return;

			const distance = distanceFromBottom(chatContent);
			isPinnedToBottom = scrolledUp ? distance <= SCROLL_SETTLE_EPSILON_PX : distance <= BOTTOM_THRESHOLD_PX;
			if (isPinnedToBottom) newMessagesBelowCount = 0;
			isUserScrolling = true;

			if (chatContent.scrollTop <= LOAD_MORE_THRESHOLD_PX && !isLoadingMore && hasMoreMessages) {
				loadMoreMessages();
			}

			clearTimeout(userScrollTimeout);
			userScrollTimeout = setTimeout(() => {
				isUserScrolling = false;
			}, USER_SCROLL_SETTLE_MS);
		}

		chatContent.addEventListener('scroll', handleScroll);

		return () => {
			chatContent?.removeEventListener('scroll', handleScroll);
			clearTimeout(userScrollTimeout);
		};
	});

	// Content can grow without firing a 'scroll' event (image/font load,
	// reaction badge), silently pushing the true bottom out of view while
	// isPinnedToBottom stays stuck true. Re-derive it (never the scroll
	// position) on resize; skip while actively scrolling so this doesn't
	// fight the direction-aware value handleScroll just set.
	$effect(() => {
		if (!messagesContainer || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver(() => {
			if (!chatContent || isUserScrolling) return;
			isPinnedToBottom = distanceFromBottom(chatContent) <= BOTTOM_THRESHOLD_PX;
		});
		observer.observe(messagesContainer);

		return () => observer.disconnect();
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

	async function connectMqtt() {
		if (!$authStore.token) return;
		try {
			await mqttService.connect($authStore.token);
			mqttUnsubscribe = mqttService.subscribeToChat(chatId, handleRealtimeMessage);
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

		pollingInterval = setInterval(pollForNewMessages, POLLING_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollingInterval) {
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
					// Process each new message similar to the realtime handler
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
		// Capture this before the append below changes it.
		const shouldFollow = wasAtBottom();

		// Add the new message to the messages array
		messages = [...messages, newMsg];

		if (shouldFollow) {
			isPinnedToBottom = true;
			scrollToBottom();
		} else {
			newMessagesBelowCount += 1;
		}

		// Refresh reactions when there's chat activity to show others' reactions
		refreshReactions();

		// Handle notifications for messages from other users
		if (newMsg.username !== $authStore.user?.username && !isWindowFocused()) {
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
		if (shouldUseColors && newMsg.username !== $authStore.user?.username) {
			addMemberColor(chatId, newMsg.userId);
		}

		// Clean up messages if we have too many
		cleanupMessages();
	}

	function handleRealtimeMessage(newMessage: Message) {
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
			const firstUnreadIndex = lastKnownTimestamp
				? messages.findIndex(msg => new Date(msg.createdAt) > new Date(lastKnownTimestamp))
				: -1;

			setTimeout(() => {
				if (firstUnreadIndex >= 0) {
					scrollToMessage(firstUnreadIndex);
				} else {
					scrollToBottom();
				}
			}, RENDER_SETTLE_DELAY_MS);

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
				const shouldFollow = wasAtBottom();

				messages = [...messages, ...newMessages];
				prevCursor = messagesResponse.prevCursor;
				cleanupMessages();

				if (shouldFollow) {
					isPinnedToBottom = true;
					scrollToBottom();
				} else {
					newMessagesBelowCount += newMessages.length;
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
		const currentUserReaction = getUserReactionForMessage(currentMessage, user.username);

		// Create optimistic update
		let newReactions: ReactionSummary[] = [...(currentMessage.reactions || [])];

		if (currentUserReaction) {
			newReactions = newReactions.map(reaction => {
				if (reaction.type === currentUserReaction) {
					const updatedUsers = reaction.users.filter(u => u.username !== user.username);
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
				if (!existingReaction.users.some(u => u.username === user.username)) {
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

			// Reaction polling runs every REACTION_POLLING_INTERVAL_MS whether
			// or not anything actually changed. mergeMessagesWithPerMessageReactions
			// always returns fresh message objects, so assigning it unconditionally
			// replaced `messages` (a new array reference) on every tick - which
			// retriggers the auto-scroll-to-bottom effect below even when no
			// message or reaction actually changed, forcing the chat back to the
			// bottom out of nowhere. Only replace the array when a reaction
			// summary actually differs.
			const mergedMessages = mergeMessagesWithPerMessageReactions(messages, reactionsByMessage, memberMapping);
			if (messagesReactionsChanged(messages, mergedMessages)) {
				messages = mergedMessages;
			}
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
			favoriteMessageIds.clear();
			for (const id of favoriteIds) favoriteMessageIds.add(id);
		} catch (err) {
			console.error('Failed to load favorite messages:', err);
		}
	}

	async function loadMoreMessages() {
		const token = $authStore.token;
		if (!token || !nextCursor || isLoadingMore) return;

		isLoadingMore = true;
		isPinnedToBottom = false;

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
				if (!chatContent) return;
				// markProgrammaticScroll() matters here: this restore lands
				// back near the top by design, and without it the resulting
				// 'scroll' event would reach handleScroll() and immediately
				// re-trigger loadMoreMessages() again - pagination looping
				// on our own scroll adjustment rather than anything the
				// user did.
				const scrollDifference = chatContent.scrollHeight - prevScrollHeight;
				markProgrammaticScroll();
				chatContent.scrollTop = prevScrollTop + scrollDifference;
			}, 0);

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load more messages';
		} finally {
			isLoadingMore = false;
		}
	}


	function goBack() {
		disconnectMqtt();
		goto(resolve('/'));
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
						throw new Error('Image too large for server. Please use a smaller image (server has lower size limits than 1MB).', { cause: uploadErr });
					} else {
						throw new Error('Failed to upload images: ' + (errorMessage || 'Unknown error'), { cause: uploadErr });
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

			// Follow our own message down to the bottom.
			isPinnedToBottom = true;
			scrollToBottom();
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
		isPinnedToBottom = true; // showJumpToNewest derives from this
		newMessagesBelowCount = 0;
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
			goto(resolve('/'));
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
			goto(resolve('/'));
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
				window.open(pendingUrl, '_blank', 'noopener,noreferrer');
			} catch (error) {
				// Without this, a failure here (e.g. a permission/scope
				// issue in the packaged app) throws inside an async click
				// handler - the promise rejection is unhandled, so the
				// modal never closes and nothing visibly happens.
				console.error('Failed to open link:', error);
				// Surface the actual error text - packaged Electron builds
				// don't give users easy access to devtools, so a generic
				// message here means we can never find out *why* it failed.
				const detail =
					error instanceof Error
						? error.message
						: typeof error === 'string'
							? error
							: JSON.stringify(error);
				linkOpenError = `Could not open this link: ${detail}`;
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

	$effect(() => {
		// Layout resize on keyboard open/close is handled declaratively by
		// `100dvh` + the `interactive-widget=resizes-content` viewport meta
		// (src/app.html) — manually resizing/translating .chat-page here as
		// well double-counts the keyboard height and leaves a blank gap
		// above it. This just keeps the thread pinned to the bottom.
		const viewport = window.visualViewport;
		if (!viewport) return;

		function handleViewportResize() {
			if (isPinnedToBottom) {
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
				const lightbox = document.querySelector('.lightbox-overlay');
				if (lightbox) {
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
			<div class="header-left">
				<button onclick={goBack} class="icon-button back-btn" title="Back" aria-label="Back to chats">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true">
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</button>
				<div class="chat-avatar" style={`--avatar-color: ${colorForChat(chatId)}`} aria-hidden="true">
					{chatName.charAt(0).toUpperCase()}
				</div>
				<div class="chat-title">
					<h1><span class="hash" aria-hidden="true">#</span>{chatName}</h1>
					<span class="member-count">
						{currentChat.members.length} member{currentChat.members.length === 1 ? '' : 's'}
						{#if $chatMuteStore.mutedChats[data.chatId]}
							<span class="muted-pill" title="Notifications muted">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" aria-hidden="true">
									<path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6M17 9l6 6" />
								</svg>
								Muted
							</span>
						{/if}
					</span>
				</div>
			</div>

			<div class="header-actions">
				<div class="member-stack" title={currentChat.members.map(m => m.name).join(', ')}>
					{#each currentChat.members.slice(0, 4) as member (member.id)}
						<span class="member-avatar" style={`--avatar-color: ${colorForChat(member.id)}`}>
							{member.name.charAt(0).toUpperCase()}
						</span>
					{/each}
					{#if currentChat.members.length > 4}
						<span class="member-avatar more">+{currentChat.members.length - 4}</span>
					{/if}
				</div>

				{#if isOwner}
					<button
						onclick={handleCreateInvite}
						class="btn btn-ghost invite-btn"
						disabled={isCreatingInvite}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true">
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="M19 8v6M22 11h-6" />
						</svg>
						<span>{isCreatingInvite ? 'Creating…' : 'Invite'}</span>
					</button>
				{/if}

				<!-- Actions menu - available to all users -->
				<DropdownMenu width="200px">
					{#snippet trigger({ toggle })}
						<button
							onclick={toggle}
							class="icon-button actions-toggle"
							disabled={$chatStore.isDeleting}
							type="button"
							title="More actions"
							aria-label="More actions"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
								<circle cx="5" cy="12" r="1.7" fill="currentColor" />
								<circle cx="12" cy="12" r="1.7" fill="currentColor" />
								<circle cx="19" cy="12" r="1.7" fill="currentColor" />
							</svg>
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
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
									<path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />
								</svg>
								<span>Unmute notifications</span>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
									<path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6M17 9l6 6" />
								</svg>
								<span>Mute notifications</span>
							{/if}
						</button>
						<div class="dropdown-separator"></div>
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
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
									<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
								</svg>
								<span>{isLeaving ? 'Leaving…' : 'Leave chat'}</span>
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
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
									<path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
								</svg>
								<span>{$chatStore.isDeleting ? 'Deleting…' : 'Delete chat'}</span>
							</button>
						{/if}
					{/snippet}
				</DropdownMenu>
			</div>
		</header>

		<!-- Main Chat Area -->
		<main class="chat-content" bind:this={chatContent}>
			<!-- Jump to newest button -->
			{#if showJumpToNewest}
				<button
					onclick={jumpToNewest}
					class="jump-to-newest-btn"
					class:has-new-messages={newMessagesBelowCount > 0}
					title={newMessagesBelowCount > 0 ? `${newMessagesBelowCount} new message${newMessagesBelowCount > 1 ? 's' : ''}` : 'Jump to newest messages'}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true">
						<path d="M12 5v14M5 12l7 7 7-7" />
					</svg>
					<span>{newMessagesBelowCount > 0 ? 'New messages' : 'Jump to latest'}</span>
					{#if newMessagesBelowCount > 0}
						<span class="new-messages-badge">{newMessagesBelowCount > 99 ? '99+' : newMessagesBelowCount}</span>
					{/if}
				</button>
			{/if}
			{#if error}
				<div class="state-container">
					<div class="state-icon error" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
							<circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
						</svg>
					</div>
					<p class="state-title">Couldn’t load messages</p>
					<p class="state-text">{error}</p>
					<button onclick={loadMessages} class="btn btn-primary">Try again</button>
				</div>
			{:else if isLoading}
				<div class="messages-container skeleton" aria-busy="true" aria-label="Loading messages">
					{#each [60, 35, 75, 45, 55] as width, i (i)}
						<div class="skeleton-row" class:own={i === 2}>
							{#if i !== 2}<span class="skeleton-avatar"></span>{/if}
							<span class="skeleton-bubble" style={`width: ${width}%`}></span>
						</div>
					{/each}
				</div>
			{:else if messages.length === 0}
				<div class="state-container intro">
					<div class="intro-avatar" style={`--avatar-color: ${colorForChat(chatId)}`} aria-hidden="true">
						{chatName.charAt(0).toUpperCase()}
					</div>
					<p class="state-title">Welcome to #{chatName}</p>
					<p class="state-text">This is the very beginning of the conversation. Say hello 👋</p>
				</div>
			{:else}
				<div class="messages-container" bind:this={messagesContainer}>
					<!-- Auto-loading indicator -->
					{#if hasMoreMessages && isLoadingMore}
						<div class="loading-more-container">
							<LoadingSpinner size="sm" inline label="Loading older messages…" />
						</div>
					{/if}

					{#each messages as message, index (message.id)}
						{@const isOwnMessage = message.username === $authStore.user?.username}
						{@const memberColor = shouldUseColors && !isOwnMessage ? getMemberColor(chatId, message.userId) : null}
						{@const authorColor = memberColor ?? colorForChat(message.userId)}
						{@const linkifyResult = linkify(message.message, true)}
						{@const layout = messageLayout[index]}
						{@const isDeleted = message.message === '[deleted message]'}
						{@const isFavorite = favoriteMessageIds.has(message.id)}
						{#if layout?.newDay}
							<div class="day-divider" role="separator">
								<span>{formatDayLabel(message.createdAt)}</span>
							</div>
						{/if}
						<div class="message-item {isOwnMessage ? 'own-message' : 'other-message'}"
						     class:group-first={layout?.first}
						     class:group-last={layout?.last}
						     class:highlighted={highlightedMessageId === message.id}
						     class:selected={selectedMessageIndex === index}
						     class:favorited={isFavorite}
						     class:deleted={isDeleted}
						     class:menu-open={openActionMenuId === message.id}
						     style={`--author-color: ${authorColor}`}>
							{#if !isOwnMessage}
								<div class="message-gutter">
									{#if layout?.first}
										<span class="message-avatar" aria-hidden="true">{message.username.charAt(0).toUpperCase()}</span>
									{:else}
										<time class="gutter-time" datetime={message.createdAt}>{formatTime(message.createdAt)}</time>
									{/if}
								</div>
							{/if}

							<div class="message-body">
								{#if layout?.first}
									<div class="message-header">
										{#if !isOwnMessage}
											<span class="message-user">{message.username}</span>
										{/if}
										<time class="message-time" datetime={message.createdAt} title={formatFullDateTime(message.createdAt)}>
											{formatTime(message.createdAt)}
										</time>
									</div>
								{/if}

								<div class="bubble-row">
									<div class="message-bubble" title={layout?.first ? undefined : formatFullDateTime(message.createdAt)}>
										{#if isFavorite}
											<span class="favorite-indicator" title="Favorited" aria-label="Favorited">
												<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
													<path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z" />
												</svg>
											</span>
										{/if}
										<div class="message-content">
											{#if isDeleted}
												<span class="deleted-text">This message was deleted</span>
											{:else if hasImages(message.message) || hasReply(message.message)}
												<!-- Message with images or replies - use ParsedMessage component -->
												<ParsedMessage
													content={message.message}
													messages={messages}
													onReplyClick={handleReplyClick}
													onLinkClick={handleLinkConfirmation}
												/>
											{:else}
												<!-- Regular text message -->
												<span class="message-text"><LinkifiedText segments={linkifyResult.segments} onLinkClick={handleLinkConfirmation} /></span>

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

									{#if !isDeleted}
										<div class="message-actions" role="toolbar" aria-label="Message actions">
											<div class="quick-reactions">
												{#each quickReactions as reaction (reaction.type)}
													<button class="action-btn reaction-quick"
													        class:active={message.reactions?.some(r => r.type === reaction.type && r.users.some(u => u.username === $authStore.user?.username))}
													        onclick={() => updateMessageReaction(message.id, reaction.type)}
													        title={reaction.label}
													        aria-label={reaction.label}>
														{reaction.emoji}
													</button>
												{/each}
												<span class="toolbar-divider" aria-hidden="true"></span>
												<button class="action-btn reply-btn"
												        onclick={() => handleReplyToMessage(message)}
												        title="Reply"
												        aria-label="Reply">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
														<path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 015 5v6" />
													</svg>
												</button>
											</div>
											<button class="action-btn menu-btn"
											        onclick={(e) => toggleActionMenu(message.id, e)}
											        title="More"
											        aria-label="More message actions"
											        aria-haspopup="menu"
											        aria-expanded={openActionMenuId === message.id}>
												<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
													<circle cx="5" cy="12" r="1.7" fill="currentColor" />
													<circle cx="12" cy="12" r="1.7" fill="currentColor" />
													<circle cx="19" cy="12" r="1.7" fill="currentColor" />
												</svg>
											</button>
											{#if openActionMenuId === message.id}
												<!-- svelte-ignore a11y_click_events_have_key_events -->
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div class="mobile-menu-backdrop" onclick={closeActionMenu}></div>
												<div class="action-dropdown" role="menu">
													<div class="sheet-handle" aria-hidden="true"></div>
													<div class="sheet-reactions">
														{#each quickReactions as reaction (reaction.type)}
															<button class="sheet-reaction-btn"
															        class:active={message.reactions?.some(r => r.type === reaction.type && r.users.some(u => u.username === $authStore.user?.username))}
															        onclick={() => { updateMessageReaction(message.id, reaction.type); closeActionMenu(); }}
															        aria-label={reaction.label}>
																{reaction.emoji}
															</button>
														{/each}
													</div>
													<button class="dropdown-item" role="menuitem"
													        onclick={() => handleReplyToMessage(message)}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
															<path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 015 5v6" />
														</svg>
														<span>Reply</span>
													</button>
													<button class="dropdown-item" role="menuitem"
													        onclick={() => handleToggleFavorite(message.id)}>
														<svg viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
															<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z" />
														</svg>
														<span>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</span>
													</button>
													{#if isOwnMessage}
														<div class="menu-separator" aria-hidden="true"></div>
														<button class="dropdown-item delete-item" role="menuitem"
														        onclick={() => handleDeleteMessage(message.id)}>
															<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
																<path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
															</svg>
															<span>Delete message</span>
														</button>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								</div>

								<!-- Message reactions -->
								{#if !isDeleted}
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

			<form onsubmit={handleMessageSubmit} class="input-container">
				<div class="composer">
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

					<div class="composer-row">
						<button
							type="button"
							class="composer-icon-btn image-btn"
							class:active={showImageUpload}
							onclick={toggleImageUpload}
							disabled={isSending || isUploadingImages}
							title="Attach images"
							aria-label="Attach images"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="19" height="19" aria-hidden="true">
								<path d="M21.4 11.1l-8.8 8.8a5.5 5.5 0 01-7.8-7.8l8.8-8.8a3.7 3.7 0 015.2 5.2l-8.8 8.8a1.8 1.8 0 01-2.6-2.6l8.1-8.1" />
							</svg>
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
									// Only jump to bottom on focus if we're already pinned
									// there - don't yank the view away from scrollback the
									// user is reading just because they tapped the input.
									if (isPinnedToBottom) {
										setTimeout(() => scrollToBottom(), FOCUS_SCROLL_DELAY_MS);
									}
								}}
								placeholder={selectedImages.length > 0 ? 'Add a caption…' : `Message #${chatName}`}
								aria-label={`Message #${chatName}`}
								disabled={isSending || isUploadingImages}
								class="message-input"
							></textarea>
						</div>
						<button
							type="button"
							class="composer-icon-btn emoji-btn"
							class:active={showEmojiPicker}
							onclick={() => showEmojiPicker = !showEmojiPicker}
							disabled={isSending || isUploadingImages}
							title="Emoji"
							aria-label="Emoji"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="19" height="19" aria-hidden="true">
								<circle cx="12" cy="12" r="9" />
								<path d="M8.5 14s1.3 1.75 3.5 1.75S15.5 14 15.5 14" />
								<circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
								<circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
							</svg>
						</button>
						<button
							type="submit"
							class="send-btn"
							class:ready={!!newMessage.trim() || selectedImages.length > 0}
							disabled={(isSending || isUploadingImages) || (!newMessage.trim() && selectedImages.length === 0)}
							title={isUploadingImages ? 'Uploading…' : isSending ? 'Sending…' : 'Send'}
							aria-label="Send message"
						>
							{#if isSending || isUploadingImages}
								<span class="send-spinner" aria-hidden="true"></span>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
									<path d="M12 19V5M5 12l7-7 7 7" />
								</svg>
							{/if}
						</button>
					</div>
				</div>
				<p class="composer-hint" aria-hidden="true">
					<kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
				</p>
			</form>
		</footer>

		<!-- Invitation Modal -->
		{#if showInviteModal && inviteCode}
			<Modal title="Invite people" description={`Share this code so someone can join #${chatName}.`} onClose={closeInviteModal}>
				<div class="invite-code-display">
					<span class="invite-code">{inviteCode}</span>
					<button onclick={copyInviteCode} class="btn btn-ghost copy-btn" class:copied={inviteCopied}>
						{inviteCopied ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="invite-note">Each code works once.</p>
			</Modal>
		{/if}

		<!-- Delete Confirmation Modal -->
		{#if showDeleteModal}
			<Modal title={`Delete #${chatName}?`} onClose={() => showDeleteModal = false}>
				<p class="modal-description">The chat and all of its messages will be permanently deleted for everyone. This can’t be undone.</p>
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
						{$chatStore.isDeleting ? 'Deleting…' : 'Delete chat'}
					</button>
				</div>
			</Modal>
		{/if}

		<!-- Leave Confirmation Modal -->
		{#if showLeaveModal}
			<Modal title={`Leave #${chatName}?`} onClose={() => showLeaveModal = false}>
				<p class="modal-description">You’ll stop receiving its messages, and you’ll need a new invitation to rejoin.</p>
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
						{isLeaving ? 'Leaving…' : 'Leave chat'}
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
			<Modal title="Open external link?" onClose={closeLinkConfirmation}>
				<div class="link-display">
					<span class="link-url">{pendingUrl}</span>
				</div>
				<p class="link-warning">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true">
						<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
					</svg>
					Only open links from people you trust.
				</p>
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
						Open link
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
		<LoadingSpinner size="lg" />
	</div>
{/if}

<style>
	.chat-page {
		/* Shared column width for the message list and composer -
		   declared once so the two can never drift apart. */
		--chat-column-width: 860px;
		--gutter-width: 36px;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--app-bg);
	}

	/* ---------------------------------------------------------------
	   Header - a flat bar with a hairline divider rather than a floating
	   card, so the conversation reads as one continuous pane.
	   --------------------------------------------------------------- */
	.chat-header {
		flex-shrink: 0;
		height: 60px;
		padding: 0 1rem 0 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--app-bg) 85%, transparent);
		-webkit-backdrop-filter: saturate(1.4) blur(12px);
		backdrop-filter: saturate(1.4) blur(12px);
		position: relative;
		z-index: 5;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.back-btn {
		display: none;
		margin-left: -0.5rem;
	}

	.chat-avatar,
	.intro-avatar,
	.member-avatar,
	.message-avatar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 650;
		color: color-mix(in srgb, var(--avatar-color) var(--identity-ink, 100%), #000);
		background: color-mix(in srgb, var(--avatar-color) 16%, var(--app-bg));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--avatar-color) 22%, transparent);
	}

	.chat-avatar {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		font-size: 0.875rem;
	}

	.chat-title {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}

	.chat-title h1 {
		margin: 0;
		min-width: 0;
		font-size: 0.9688rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chat-title .hash {
		color: var(--text-muted);
		font-weight: 400;
		margin-right: 0.0625rem;
	}

	.member-count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.muted-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.375rem;
		border-radius: var(--radius-pill);
		background: var(--surface-hover);
		font-size: 0.6875rem;
		color: var(--text-secondary);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.member-stack {
		display: flex;
		align-items: center;
		padding-right: 0.25rem;
		margin-right: 0.25rem;
	}

	.member-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		font-size: 0.6875rem;
		margin-left: -7px;
		border: 2px solid var(--app-bg);
		box-shadow: none;
		background: color-mix(in srgb, var(--avatar-color) 22%, var(--app-bg));
	}

	.member-avatar:first-child {
		margin-left: 0;
	}

	.member-avatar.more {
		--avatar-color: var(--text-secondary);
		font-size: 0.625rem;
		background: var(--surface-alt);
	}

	.invite-btn {
		height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.8125rem;
	}

	/* ---------------------------------------------------------------
	   Message list
	   --------------------------------------------------------------- */
	.chat-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 1.5rem 1rem;
		width: 100%;
		position: relative;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.messages-container {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
		max-width: var(--chat-column-width);
		margin: 0 auto;
	}

	.loading-more-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	/* Skeleton loading */
	.skeleton-row {
		display: flex;
		align-items: flex-end;
		gap: 0.625rem;
		margin-top: 1rem;
	}

	.skeleton-row.own {
		justify-content: flex-end;
	}

	.skeleton-avatar {
		width: var(--gutter-width);
		height: var(--gutter-width);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.skeleton-bubble {
		height: 42px;
		max-width: 480px;
		border-radius: 16px;
	}

	.skeleton-avatar,
	.skeleton-bubble {
		background: linear-gradient(90deg, var(--surface-hover) 0%, var(--surface-alt) 50%, var(--surface-hover) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}

	/* Empty / error states */
	.state-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		height: 100%;
		max-width: 360px;
		margin: 0 auto;
		animation: fadeIn 0.35s var(--ease-out-expo);
	}

	.state-icon {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.state-icon.error {
		color: var(--error-text);
		background: var(--error-bg);
	}

	.intro-avatar {
		width: 64px;
		height: 64px;
		border-radius: 18px;
		font-size: 1.625rem;
		margin-bottom: 1.125rem;
	}

	.state-title {
		margin: 0 0 0.375rem;
		font-size: 1.0625rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.state-text {
		margin: 0 0 1.25rem;
		font-size: 0.875rem;
		color: var(--text-muted);
		text-wrap: balance;
	}

	/* Day divider */
	.day-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.02em;
	}

	.day-divider::before,
	.day-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.day-divider span {
		padding: 0.1875rem 0.625rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border);
		background: var(--app-bg);
	}

	/* ---- A single message ---- */
	.message-item {
		display: flex;
		gap: 0.625rem;
		position: relative;
		margin-top: 2px;
		border-radius: var(--radius-md);
	}

	.message-item.group-first {
		margin-top: 0.875rem;
	}

	.own-message {
		justify-content: flex-end;
	}

	.message-gutter {
		width: var(--gutter-width);
		flex-shrink: 0;
		display: flex;
		justify-content: center;
	}

	/* Sits beside the group's first bubble, below the name/time header. */
	.message-avatar {
		--avatar-color: var(--author-color);
		width: var(--gutter-width);
		height: var(--gutter-width);
		border-radius: 50%;
		font-size: 0.8125rem;
		margin-top: 1.4375rem;
	}

	.gutter-time {
		align-self: center;
		font-size: 0.625rem;
		color: var(--text-muted);
		opacity: 0;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		transition: opacity 0.12s ease;
	}

	.message-item:hover .gutter-time {
		opacity: 1;
	}

	.message-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-width: min(72%, 620px);
	}

	.own-message .message-body {
		align-items: flex-end;
	}

	.message-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0.75rem 0.25rem;
	}

	.message-user {
		font-size: 0.8125rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--author-color) var(--identity-ink, 100%), #000);
	}

	.message-time {
		font-size: 0.6875rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.bubble-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 100%;
	}

	.own-message .bubble-row {
		flex-direction: row-reverse;
	}

	/* Bubble shape: fully rounded, with the corner nearest the author
	   tightened between consecutive messages in a group. */
	.message-bubble {
		--r: 18px;
		--r-tight: 6px;
		position: relative;
		min-width: 0;
		padding: 0.5rem 0.875rem;
		border-radius: var(--r);
		background: var(--bubble-other);
		color: var(--text-primary);
		transition: box-shadow 0.2s ease;
	}

	.other-message:not(.group-first) .message-bubble {
		border-top-left-radius: var(--r-tight);
	}

	.other-message:not(.group-last) .message-bubble {
		border-bottom-left-radius: var(--r-tight);
	}

	.own-message .message-bubble {
		background: var(--bubble-own);
		color: var(--bubble-own-text);
	}

	.own-message:not(.group-first) .message-bubble {
		border-top-right-radius: var(--r-tight);
	}

	.own-message:not(.group-last) .message-bubble {
		border-bottom-right-radius: var(--r-tight);
	}

	.message-item.deleted .message-bubble {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--border-hover);
	}

	.deleted-text {
		font-style: italic;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.message-item.selected .message-bubble {
		box-shadow: 0 0 0 2px var(--accent);
	}

	@keyframes highlightPulse {
		0%,
		30% {
			box-shadow: 0 0 0 3px var(--accent), 0 0 0 8px var(--accent-subtle);
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	.message-item.highlighted .message-bubble {
		animation: highlightPulse 1.8s ease-out;
	}

	.favorite-indicator {
		position: absolute;
		top: -5px;
		width: 17px;
		height: 17px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1a1405;
		background: var(--warning-text);
		box-shadow: 0 0 0 2px var(--app-bg);
		z-index: 1;
	}

	.other-message .favorite-indicator {
		right: -5px;
	}

	.own-message .favorite-indicator {
		left: -5px;
	}

	.message-content {
		position: relative;
		line-height: 1.5;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}

	/* pre-line only on the text itself - on the whole content box it would
	   also render the template's own whitespace around previews/GIFs as
	   blank lines. */
	.message-text {
		white-space: pre-line;
	}

	.message-previews {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.message-gifs {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 6px;
	}

	.message-content :global(.message-link) {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
		text-underline-offset: 2px;
		word-break: break-all;
		transition: text-decoration-color 0.12s ease;
	}

	.message-content :global(.message-link):hover {
		text-decoration-color: currentColor;
	}

	:global([data-theme='light']) .own-message .message-content :global(.message-link) {
		color: #fff;
	}

	:global([data-theme='dark']) .own-message .message-content :global(.message-link) {
		color: #c9c1f5;
	}

	/* ---- Hover toolbar ---- */
	.message-actions {
		position: absolute;
		top: -14px;
		display: flex;
		align-items: center;
		gap: 1px;
		padding: 2px;
		border-radius: 10px;
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		box-shadow: var(--shadow-md);
		opacity: 0;
		transform: translateY(2px);
		pointer-events: none;
		transition: opacity 0.12s ease, transform 0.12s ease;
		z-index: 3;
	}

	.other-message .message-actions {
		right: -8px;
		transform-origin: right;
	}

	.own-message .message-actions {
		left: -8px;
	}

	.message-item:hover .message-actions,
	.message-item.menu-open .message-actions,
	.message-actions:focus-within {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
	}

	.quick-reactions {
		display: flex;
		align-items: center;
		gap: 1px;
	}

	.toolbar-divider {
		width: 1px;
		height: 16px;
		margin: 0 2px;
		background: var(--border-hover);
	}

	.action-btn {
		width: 28px;
		height: 28px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.9375rem;
		line-height: 1;
		cursor: pointer;
		transition: background-color 0.1s ease, color 0.1s ease, transform 0.1s ease;
	}

	.action-btn:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.reaction-quick:hover {
		transform: scale(1.15);
	}

	.reaction-quick.active {
		background: var(--accent-subtle);
	}

	/* Message action menu */
	.action-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 200px;
		padding: 0.3125rem;
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		animation: menuIn 0.14s var(--ease-out-expo);
	}

	.own-message .action-dropdown {
		right: auto;
		left: 0;
	}

	@keyframes menuIn {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(-2px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.action-dropdown .dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		height: 2.125rem;
		padding: 0 0.625rem;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--text-primary);
		white-space: nowrap;
		transition: background-color 0.1s ease;
	}

	.action-dropdown .dropdown-item svg {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.action-dropdown .dropdown-item:hover {
		background: var(--surface-hover);
	}

	.action-dropdown .dropdown-item:hover svg {
		color: var(--text-primary);
	}

	.action-dropdown .delete-item,
	.action-dropdown .delete-item svg,
	.action-dropdown .delete-item:hover svg {
		color: var(--danger);
	}

	.action-dropdown .delete-item:hover {
		background: var(--error-bg);
	}

	.menu-separator {
		height: 1px;
		margin: 0.3125rem -0.3125rem;
		background: var(--border);
	}

	/* Bottom-sheet-only parts, hidden on desktop */
	.sheet-reactions,
	.sheet-handle,
	.mobile-menu-backdrop {
		display: none;
	}

	/* Touch devices have no hover: show a quiet, always-visible "more"
	   button beside the bubble instead of the floating toolbar. */
	@media (hover: none) {
		.message-actions,
		.message-actions:focus-within {
			position: static;
			opacity: 1;
			transform: none;
			pointer-events: auto;
			padding: 0;
			background: none;
			border: none;
			box-shadow: none;
		}

		.quick-reactions {
			display: none;
		}

		.menu-btn {
			color: var(--text-muted);
			opacity: 0.7;
		}
	}

	/* ---------------------------------------------------------------
	   Jump to latest
	   --------------------------------------------------------------- */
	.jump-to-newest-btn {
		position: sticky;
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.125rem;
		padding: 0 0.875rem 0 0.75rem;
		background: var(--panel-bg);
		color: var(--text-primary);
		border: 1px solid var(--border-hover);
		border-radius: var(--radius-pill);
		font-size: 0.8125rem;
		font-weight: 550;
		cursor: pointer;
		z-index: 100;
		box-shadow: var(--shadow-lg);
		transition: background-color 0.15s ease, box-shadow 0.15s ease;
		animation: slideInUp 0.25s var(--ease-out-expo);
	}

	.jump-to-newest-btn:hover {
		background: var(--surface-hover);
	}

	.jump-to-newest-btn:active {
		transform: translateX(-50%) scale(0.97);
	}

	.jump-to-newest-btn.has-new-messages {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: transparent;
		box-shadow: var(--shadow-lg), 0 6px 20px var(--accent-shadow);
	}

	.new-messages-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.35rem;
		border-radius: var(--radius-pill);
		background: var(--accent-contrast);
		color: var(--accent);
		font-size: 0.6875rem;
		font-weight: 700;
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* ---------------------------------------------------------------
	   Composer
	   --------------------------------------------------------------- */
	.message-input-area {
		flex-shrink: 0;
		padding: 0 1.5rem 0.5rem;
		padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
	}

	.send-error {
		max-width: var(--chat-column-width);
		margin: 0 auto 0.5rem;
	}

	.input-container {
		max-width: var(--chat-column-width);
		margin: 0 auto;
	}

	.composer {
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--panel-bg);
		border: 1px solid var(--border-hover);
		border-radius: 16px;
		box-shadow: var(--shadow-md);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.composer:focus-within {
		border-color: color-mix(in srgb, var(--accent) 60%, var(--border-hover));
		box-shadow: var(--shadow-md), 0 0 0 3px var(--focus-ring);
	}

	.reply-composition-container {
		padding: 0.5rem 0.5rem 0;
	}

	.image-upload-section {
		margin: 0.5rem 0.5rem 0;
		padding: 0.625rem;
		border-radius: var(--radius-md);
		background: var(--surface-hover);
	}

	.composer-row {
		display: flex;
		align-items: flex-end;
		gap: 0.125rem;
		padding: 0.375rem;
	}

	.composer-icon-btn {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
	}

	.composer-icon-btn:hover:not(:disabled),
	.composer-icon-btn.active {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.composer-icon-btn:active:not(:disabled) {
		transform: scale(0.92);
	}

	.composer-icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.textarea-wrapper {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.message-input {
		width: 100%;
		padding: 0.4375rem 0.375rem;
		border-radius: 0;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9375rem;
		resize: none;
		overflow-y: auto;
		height: 36px;
		min-height: 36px;
		max-height: 160px;
		line-height: 1.5;
		scrollbar-width: none;
		box-sizing: border-box;
		transition: none;
	}

	.message-input::-webkit-scrollbar {
		display: none;
	}

	/* The global textarea:focus rule adds its own ring - override it here
	   so focus shows once, on the composer. */
	.message-input:focus,
	.message-input:hover {
		outline: none;
		box-shadow: none;
		border-color: transparent;
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		margin-left: 0.25rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: var(--surface-alt);
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.18s ease, color 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease;
	}

	.send-btn.ready {
		background: var(--accent);
		color: var(--accent-contrast);
		box-shadow: 0 2px 8px var(--accent-shadow);
	}

	.send-btn.ready:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.send-btn:active:not(:disabled) {
		transform: scale(0.92);
	}

	.send-btn:disabled {
		cursor: default;
	}

	.send-spinner {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.composer-hint {
		margin: 0.375rem 0.25rem 0;
		font-size: 0.6875rem;
		color: var(--text-muted);
		text-align: right;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.input-container:focus-within .composer-hint {
		opacity: 1;
	}

	.composer-hint kbd {
		font-family: inherit;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.loading-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
		min-height: 0;
		color: var(--text-muted);
	}

	/* ---------------------------------------------------------------
	   Modal content (the Modal component owns the chrome)
	   --------------------------------------------------------------- */
	.modal-description {
		margin: 0 0 0.75rem 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.invite-code-display {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 0 0 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		background: var(--surface-hover);
		border-radius: var(--radius-md);
		border: 1px dashed var(--border-hover);
	}

	.invite-code {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: 0.08em;
		user-select: all;
	}

	.copy-btn {
		height: 2rem;
		flex-shrink: 0;
	}

	.copy-btn.copied {
		color: var(--success-text);
		border-color: var(--success-border);
	}

	.invite-note {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.modal-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.link-display {
		margin: 0 0 0.75rem;
		padding: 0.75rem 0.875rem;
		background: var(--surface-hover);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		word-break: break-all;
	}

	.link-url {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-primary);
		display: block;
	}

	.link-warning {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* ---------------------------------------------------------------
	   Responsive
	   --------------------------------------------------------------- */
	@media (max-width: 1100px) {
		.member-stack {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.chat-page {
			--gutter-width: 30px;
			padding-top: env(safe-area-inset-top);
		}

		.chat-header {
			height: 56px;
			padding: 0 0.5rem 0 0.75rem;
		}

		.back-btn {
			display: inline-flex;
			margin-left: -0.25rem;
		}

		.header-left {
			gap: 0.5rem;
		}

		.chat-avatar {
			width: 34px;
			height: 34px;
		}

		.invite-btn span {
			display: none;
		}

		.invite-btn {
			width: 2rem;
			padding: 0;
			border: none;
		}

		.chat-content {
			padding: 0.25rem 0.75rem 0.75rem;
		}

		.message-body {
			max-width: 82%;
		}

		.message-item.group-first {
			margin-top: 0.75rem;
		}

		.gutter-time {
			display: none;
		}

		.message-input-area {
			padding: 0 0.625rem 0.5rem;
			padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
		}

		.composer-hint {
			display: none;
		}

		/* A transform on the toolbar (its hover/focus-within reveal) would
		   become the containing block for the position: fixed sheet below,
		   trapping it inside the toolbar - so none while the menu is open. */
		.message-item.menu-open .message-actions {
			transform: none;
		}

		/* Bottom sheet */
		.mobile-menu-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: var(--overlay-bg);
			-webkit-backdrop-filter: blur(3px);
			backdrop-filter: blur(3px);
			z-index: 9998;
			animation: backdropIn 0.2s ease-out;
		}

		@keyframes backdropIn {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}

		.action-dropdown,
		.own-message .action-dropdown,
		.other-message .action-dropdown {
			position: fixed;
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 9999;
			min-width: 100%;
			margin: 0;
			padding: 0.5rem 0.75rem;
			padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			border-bottom: none;
			animation: sheetUp 0.28s var(--ease-out-expo);
		}

		@keyframes sheetUp {
			from {
				transform: translateY(100%);
			}
			to {
				transform: translateY(0);
			}
		}

		.sheet-handle {
			display: block;
			width: 36px;
			height: 4px;
			margin: 0.125rem auto 0.75rem;
			border-radius: 999px;
			background: var(--border-hover);
		}

		.sheet-reactions {
			display: flex;
			justify-content: center;
			gap: 0.75rem;
			padding: 0.25rem 0 1rem;
			margin-bottom: 0.375rem;
			border-bottom: 1px solid var(--border);
		}

		.sheet-reaction-btn {
			width: 52px;
			height: 52px;
			border-radius: 50%;
			border: none;
			background: var(--surface-hover);
			font-size: 1.5rem;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: transform 0.12s ease, background-color 0.12s ease;
		}

		.sheet-reaction-btn:active {
			transform: scale(0.9);
		}

		.sheet-reaction-btn.active {
			background: var(--accent-subtle);
			box-shadow: inset 0 0 0 2px var(--accent);
		}

		.action-dropdown .dropdown-item {
			height: 3rem;
			font-size: 0.9375rem;
			gap: 0.875rem;
			padding: 0 0.75rem;
		}

		.action-dropdown .dropdown-item svg {
			width: 20px;
			height: 20px;
		}

		.jump-to-newest-btn {
			height: 2rem;
			font-size: 0.75rem;
		}
	}

	@media (max-width: 428px) {
		.chat-title h1 {
			max-width: 16ch;
		}
	}
</style>

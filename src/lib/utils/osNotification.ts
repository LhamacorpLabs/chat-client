/**
 * OS Notification utilities for new message alerts
 */

// Track active notifications to prevent memory leaks
const activeNotifications = new Map<string, Notification>();

interface NotificationOptions {
	title: string;
	body: string;
	icon?: string;
	tag?: string;
	chatId: string;
}

/**
 * Requests notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (!('Notification' in window)) {
		console.warn('This browser does not support notifications');
		return 'denied';
	}

	if (Notification.permission === 'default') {
		return await Notification.requestPermission();
	}

	return Notification.permission;
}

/**
 * Properly closes and cleans up a notification
 */
function cleanupNotification(notificationTag: string) {
	const notification = activeNotifications.get(notificationTag);
	if (notification) {
		// Clear event handlers to prevent memory leaks
		notification.onclick = null;
		notification.onclose = null;
		notification.onerror = null;

		// Close the notification if it's still open
		notification.close();

		// Remove from tracking
		activeNotifications.delete(notificationTag);
	}
}

/**
 * Shows an OS notification for a new message
 */
export async function showMessageNotification(options: NotificationOptions): Promise<void> {
	// Check permission (this will handle browser support check internally)
	const permission = await requestNotificationPermission();
	if (permission !== 'granted') {
		console.warn('Notification permission denied');
		return;
	}

	// Don't show notification if window is focused
	if (!document.hidden && document.hasFocus()) {
		return;
	}

	try {
		const notificationTag = options.tag || `chat-${options.chatId}`;

		// Close any existing notification for this chat to prevent accumulation
		cleanupNotification(notificationTag);

		const notification = new Notification(options.title, {
			body: options.body,
			icon: options.icon || '/favicon.ico',
			tag: notificationTag,
			requireInteraction: false,
			silent: false
		});

		// Track the notification
		activeNotifications.set(notificationTag, notification);

		// Auto-close after 5 seconds with proper cleanup
		const timeoutId = setTimeout(() => {
			cleanupNotification(notificationTag);
		}, 5000);

		// Handle click to focus window and navigate to chat
		notification.onclick = () => {
			clearTimeout(timeoutId);
			window.focus();

			// Navigate to chat if not already there
			const currentPath = window.location.pathname;
			const chatPath = `/chat/${options.chatId}`;

			if (currentPath !== chatPath) {
				window.location.href = chatPath;
			}

			cleanupNotification(notificationTag);
		};

		// Handle close with proper cleanup
		notification.onclose = () => {
			clearTimeout(timeoutId);
			activeNotifications.delete(notificationTag);
		};

		// Handle error with proper cleanup
		notification.onerror = (error) => {
			clearTimeout(timeoutId);
			console.error('Notification error:', error);
			cleanupNotification(notificationTag);
		};

	} catch (error) {
		console.error('Failed to show notification:', error);
	}
}

/**
 * Cleans up all active notifications (call on app shutdown)
 */
export function cleanupAllNotifications(): void {
	for (const [tag, notification] of activeNotifications.entries()) {
		// Clear event handlers
		notification.onclick = null;
		notification.onclose = null;
		notification.onerror = null;

		// Close notification
		notification.close();
	}

	// Clear the map
	activeNotifications.clear();
}

/**
 * Checks if OS notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
	return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Gets current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}
/**
 * OS Notification utilities for new message alerts
 */

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
 * Shows an OS notification for a new message
 */
export async function showMessageNotification(options: NotificationOptions): Promise<void> {
	// Check if notifications are supported
	if (!('Notification' in window)) {
		console.warn('This browser does not support notifications');
		return;
	}

	// Check permission
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
		const notification = new Notification(options.title, {
			body: options.body,
			icon: options.icon || '/favicon.ico',
			tag: options.tag || `chat-${options.chatId}`,
			requireInteraction: false,
			silent: false
		});

		// Auto-close after 5 seconds
		setTimeout(() => {
			notification.close();
		}, 5000);

		// Handle click to focus window and navigate to chat
		notification.onclick = () => {
			window.focus();

			// Navigate to chat if not already there
			const currentPath = window.location.pathname;
			const chatPath = `/chat/${options.chatId}`;

			if (currentPath !== chatPath) {
				window.location.href = chatPath;
			}

			notification.close();
		};

		// Handle close
		notification.onclose = () => {
			// Optional: track notification dismissed
		};

		// Handle error
		notification.onerror = (error) => {
			console.error('Notification error:', error);
		};

	} catch (error) {
		console.error('Failed to show notification:', error);
	}
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
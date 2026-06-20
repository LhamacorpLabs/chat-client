/**
 * OS Notification utilities for new message alerts.
 * Supports both browser Notification API and Tauri native notifications.
 */

const activeNotifications = new Map<string, Notification>();

interface NotificationOptions {
	title: string;
	body: string;
	icon?: string;
	tag?: string;
	chatId: string;
}

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (isTauri()) {
		const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
		let permitted = await isPermissionGranted();
		if (!permitted) {
			const result = await requestPermission();
			permitted = result === 'granted';
		}
		return permitted ? 'granted' : 'denied';
	}

	if (!('Notification' in window)) {
		console.warn('This browser does not support notifications');
		return 'denied';
	}

	if (Notification.permission === 'default') {
		return await Notification.requestPermission();
	}

	return Notification.permission;
}

function cleanupNotification(notificationTag: string) {
	const notification = activeNotifications.get(notificationTag);
	if (notification) {
		notification.onclick = null;
		notification.onclose = null;
		notification.onerror = null;
		notification.close();
		activeNotifications.delete(notificationTag);
	}
}

export async function showMessageNotification(options: NotificationOptions): Promise<void> {
	const permission = await requestNotificationPermission();
	if (permission !== 'granted') {
		console.warn('Notification permission denied');
		return;
	}

	if (!document.hidden && document.hasFocus()) {
		return;
	}

	try {
		const notificationTag = options.tag || `chat-${options.chatId}`;

		if (isTauri()) {
			const { sendNotification } = await import('@tauri-apps/plugin-notification');
			sendNotification({ title: options.title, body: options.body });
			return;
		}

		cleanupNotification(notificationTag);

		const notification = new Notification(options.title, {
			body: options.body,
			icon: options.icon || '/favicon.ico',
			tag: notificationTag,
			requireInteraction: false,
			silent: false
		});

		activeNotifications.set(notificationTag, notification);

		const timeoutId = setTimeout(() => {
			cleanupNotification(notificationTag);
		}, 5000);

		notification.onclick = () => {
			clearTimeout(timeoutId);
			window.focus();

			const currentPath = window.location.pathname;
			const chatPath = `/chat/${options.chatId}`;

			if (currentPath !== chatPath) {
				window.location.href = chatPath;
			}

			cleanupNotification(notificationTag);
		};

		notification.onclose = () => {
			clearTimeout(timeoutId);
			activeNotifications.delete(notificationTag);
		};

		notification.onerror = (error) => {
			clearTimeout(timeoutId);
			console.error('Notification error:', error);
			cleanupNotification(notificationTag);
		};

	} catch (error) {
		console.error('Failed to show notification:', error);
	}
}

export function cleanupAllNotifications(): void {
	for (const [, notification] of activeNotifications.entries()) {
		notification.onclick = null;
		notification.onclose = null;
		notification.onerror = null;
		notification.close();
	}
	activeNotifications.clear();
}

export function canShowNotifications(): boolean {
	if (isTauri()) {
		return true;
	}
	return 'Notification' in window && Notification.permission === 'granted';
}

export function getNotificationPermission(): NotificationPermission {
	if (isTauri()) {
		return 'granted';
	}
	if (!('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}
/**
 * localStorage Management and Cleanup Utilities
 * Prevents localStorage from growing unbounded and manages old data
 */

interface LocalStorageStats {
	totalKeys: number;
	estimatedSize: number;
	keysBySize: Array<{ key: string; size: number }>;
}

/**
 * Calculate the approximate size of a string in bytes
 */
function getStringSize(str: string): number {
	return new Blob([str]).size;
}

/**
 * Get statistics about current localStorage usage
 */
export function getLocalStorageStats(): LocalStorageStats {
	const keysBySize: Array<{ key: string; size: number }> = [];
	let totalSize = 0;

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			const value = localStorage.getItem(key) || '';
			const size = getStringSize(key) + getStringSize(value);
			keysBySize.push({ key, size });
			totalSize += size;
		}
	}

	return {
		totalKeys: localStorage.length,
		estimatedSize: totalSize,
		keysBySize: keysBySize.sort((a, b) => b.size - a.size)
	};
}

/**
 * Clean up member colors for chats that no longer exist
 */
export function cleanupMemberColors(activeChatIds: string[]): void {
	try {
		const memberColorsData = localStorage.getItem('member_colors');
		if (!memberColorsData) return;

		const memberColors = JSON.parse(memberColorsData);
		let hasChanges = false;

		// Remove colors for chats that are no longer active
		Object.keys(memberColors).forEach(chatId => {
			if (!activeChatIds.includes(chatId)) {
				delete memberColors[chatId];
				hasChanges = true;
			}
		});

		if (hasChanges) {
			localStorage.setItem('member_colors', JSON.stringify(memberColors));
					}
	} catch (error) {
		console.warn('Failed to cleanup member colors:', error);
	}
}

/**
 * Clean up chat notifications for chats that no longer exist
 */
export function cleanupChatNotifications(activeChatIds: string[]): void {
	try {
		const notificationData = localStorage.getItem('chat-notifications');
		if (!notificationData) return;

		const notifications = JSON.parse(notificationData);
		let hasChanges = false;

		// Clean up lastKnownTimestamps
		if (notifications.lastKnownTimestamps) {
			Object.keys(notifications.lastKnownTimestamps).forEach(chatId => {
				if (!activeChatIds.includes(chatId)) {
					delete notifications.lastKnownTimestamps[chatId];
					hasChanges = true;
				}
			});
		}

		// Clean up hasUnreadMessages
		if (notifications.hasUnreadMessages) {
			Object.keys(notifications.hasUnreadMessages).forEach(chatId => {
				if (!activeChatIds.includes(chatId)) {
					delete notifications.hasUnreadMessages[chatId];
					hasChanges = true;
				}
			});
		}

		if (hasChanges) {
			localStorage.setItem('chat-notifications', JSON.stringify(notifications));
					}
	} catch (error) {
		console.warn('Failed to cleanup chat notifications:', error);
	}
}

/**
 * Clean up chat mute settings for chats that no longer exist
 */
export function cleanupChatMutes(activeChatIds: string[]): void {
	try {
		const muteData = localStorage.getItem('chat_mutes');
		if (!muteData) return;

		const mutes = JSON.parse(muteData);
		let hasChanges = false;

		Object.keys(mutes).forEach(chatId => {
			if (!activeChatIds.includes(chatId)) {
				delete mutes[chatId];
				hasChanges = true;
			}
		});

		if (hasChanges) {
			localStorage.setItem('chat_mutes', JSON.stringify(mutes));
					}
	} catch (error) {
		console.warn('Failed to cleanup chat mute settings:', error);
	}
}

/**
 * Comprehensive cleanup of all chat-related localStorage data
 */
export function cleanupAllChatData(activeChatIds: string[]): void {

	cleanupMemberColors(activeChatIds);
	cleanupChatNotifications(activeChatIds);
	cleanupChatMutes(activeChatIds);
}

/**
 * Emergency cleanup when localStorage is getting too large
 * Removes oldest data entries to free up space
 */
export function emergencyCleanup(): void {
	const stats = getLocalStorageStats();
	const MAX_SIZE = 5 * 1024 * 1024; // 5MB threshold

	if (stats.estimatedSize < MAX_SIZE) {
		return; // No cleanup needed
	}

	console.warn(`localStorage is large (${Math.round(stats.estimatedSize / 1024)}KB), performing emergency cleanup`);

	// Remove non-essential data first
	const nonEssentialKeys = stats.keysBySize
		.filter(item => !['auth_data', 'theme'].includes(item.key))
		.slice(-Math.floor(stats.keysBySize.length * 0.3)); // Remove bottom 30%

	nonEssentialKeys.forEach(item => {
		localStorage.removeItem(item.key);
	});
}

/**
 * Schedule periodic cleanup to run
 * Call this once on app startup
 */
export function schedulePeriodicCleanup(): void {
	// Run cleanup every 30 minutes
	setInterval(() => {
		try {
			const stats = getLocalStorageStats();

			// Only run emergency cleanup if we're using significant space
			if (stats.estimatedSize > 2 * 1024 * 1024) { // 2MB threshold
				emergencyCleanup();
			}
		} catch (error) {
			console.warn('Periodic cleanup failed:', error);
		}
	}, 30 * 60 * 1000); // 30 minutes
}


const STORAGE_KEY = 'last_app_open_date';

function getTodayDate(): string {
	const today = new Date();
	return today.toISOString().split('T')[0];
}

export function checkAndRefreshIfNewDay(): boolean {
	try {
		const today = getTodayDate();
		const lastOpenDate = localStorage.getItem(STORAGE_KEY);

		// First visit ever or new day detected
		if (!lastOpenDate || lastOpenDate !== today) {
			// Update storage BEFORE reloading to prevent infinite refresh loops
			localStorage.setItem(STORAGE_KEY, today);

			// Only refresh if this is not the first visit (lastOpenDate exists)
			if (lastOpenDate) {
				window.location.reload();
				return true;
			}
		}

		return false;
	} catch (error) {
		console.warn('Failed to check daily refresh status:', error);
		return false;
	}
}

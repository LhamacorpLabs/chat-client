/**
 * Shared try/catch-JSON load/save helpers for stores backed by localStorage.
 * Not to be confused with `persistentStore.ts`, which hydrates auth state
 * from Electron's on-disk store - this is plain localStorage only.
 */

export function loadPersisted<T>(key: string, fallback: T, onError?: () => void): T {
	if (typeof localStorage === 'undefined') return fallback;

	try {
		const stored = localStorage.getItem(key);
		if (stored === null) return fallback;
		return JSON.parse(stored) as T;
	} catch (error) {
		console.warn(`Failed to load "${key}" from localStorage:`, error);
		onError?.();
		return fallback;
	}
}

export function savePersisted<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.warn(`Failed to save "${key}" to localStorage:`, error);
	}
}

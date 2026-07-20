import type { AuthResponse } from '../types/auth';

const STORE_KEY = 'auth_data';

type ElectronStore = NonNullable<Window['electronAPI']>['store'];

function getElectronStore(): ElectronStore | undefined {
	if (typeof window === 'undefined' || !window.electronAPI) return undefined;
	return window.electronAPI.store;
}

/**
 * localStorage persistence inside a webview isn't reliable on every
 * platform/webview version - there are documented cases (particularly on
 * macOS/WKWebView-based shells) where it doesn't survive an app restart
 * even though the app itself, and the rest of its data directory, persists
 * fine. The Electron desktop build instead writes to an actual JSON file in
 * the app's userData directory (via the main process), which is far more
 * dependable.
 *
 * Rather than rewrite every one of the many call sites across the app that
 * read `localStorage.getItem('auth_data')` synchronously, localStorage
 * stays the primary, synchronous source of truth. This function just
 * hydrates it from the durable on-disk store at startup, but ONLY when
 * localStorage came up empty - so it restores a session that the webview
 * failed to persist, without ever clobbering a live one.
 */
export async function hydrateAuthFromPersistentStore(): Promise<void> {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(STORE_KEY)) return;

	const store = getElectronStore();
	if (!store) return;

	try {
		const data = await store.get<AuthResponse>(STORE_KEY);
		if (data) {
			localStorage.setItem(STORE_KEY, JSON.stringify(data));
		}
	} catch (error) {
		console.warn('Failed to hydrate auth session from persistent store:', error);
	}
}

export async function persistAuthData(data: AuthResponse): Promise<void> {
	const store = getElectronStore();
	if (!store) return;

	try {
		await store.set(STORE_KEY, data);
	} catch (error) {
		console.warn('Failed to persist auth session to disk store:', error);
	}
}

export async function clearPersistedAuthData(): Promise<void> {
	const store = getElectronStore();
	if (!store) return;

	try {
		await store.delete(STORE_KEY);
	} catch (error) {
		console.warn('Failed to clear persisted auth session:', error);
	}
}

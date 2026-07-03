import type { AuthResponse } from '../types/auth';

const STORE_FILE = 'auth.json';
const STORE_KEY = 'auth_data';

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let tauriStorePromise: Promise<any> | null = null;

async function getTauriStore(): Promise<any | null> {
	if (!isTauri()) return null;

	if (!tauriStorePromise) {
		tauriStorePromise = (async () => {
			try {
				const { LazyStore } = await import('@tauri-apps/plugin-store');
				return new LazyStore(STORE_FILE);
			} catch (error) {
				console.warn('Tauri store plugin unavailable:', error);
				return null;
			}
		})();
	}

	return tauriStorePromise;
}

/**
 * localStorage persistence inside a Tauri webview isn't reliable on every
 * platform/webview version - there are documented cases (particularly on
 * macOS/WKWebView) where it doesn't survive an app restart even though the
 * app itself, and the rest of its data directory, persists fine. The Tauri
 * store plugin instead writes to an actual JSON file in the app's data
 * directory, which is far more dependable.
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

	const store = await getTauriStore();
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
	const store = await getTauriStore();
	if (!store) return;

	try {
		await store.set(STORE_KEY, data);
		await store.save();
	} catch (error) {
		console.warn('Failed to persist auth session to disk store:', error);
	}
}

export async function clearPersistedAuthData(): Promise<void> {
	const store = await getTauriStore();
	if (!store) return;

	try {
		await store.delete(STORE_KEY);
		await store.save();
	} catch (error) {
		console.warn('Failed to clear persisted auth session:', error);
	}
}

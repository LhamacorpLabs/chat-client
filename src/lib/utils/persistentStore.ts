import type { AuthResponse } from '../types/auth';

const STORE_FILE = 'auth.json';
const STORE_KEY = 'auth_data';

let tauriStore: any = null;
let storeReady: Promise<void> | null = null;

function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function getStore() {
	if (!isTauri()) return null;

	if (tauriStore) return tauriStore;

	if (!storeReady) {
		storeReady = (async () => {
			const { LazyStore } = await import('@tauri-apps/plugin-store');
			tauriStore = new LazyStore(STORE_FILE);
		})();
	}

	await storeReady;
	return tauriStore;
}

export async function saveAuthData(data: AuthResponse): Promise<void> {
	localStorage.setItem(STORE_KEY, JSON.stringify(data));

	const store = await getStore();
	if (store) {
		await store.set(STORE_KEY, data);
		await store.save();
	}
}

export async function loadAuthData(): Promise<AuthResponse | null> {
	const store = await getStore();
	if (store) {
		const data = await store.get(STORE_KEY);
		if (data) {
			localStorage.setItem(STORE_KEY, JSON.stringify(data));
			return data as AuthResponse;
		}
	}

	const saved = localStorage.getItem(STORE_KEY);
	if (saved) {
		try {
			return JSON.parse(saved) as AuthResponse;
		} catch {
			return null;
		}
	}

	return null;
}

export async function clearAuthData(): Promise<void> {
	localStorage.removeItem(STORE_KEY);

	const store = await getStore();
	if (store) {
		await store.delete(STORE_KEY);
		await store.save();
	}
}

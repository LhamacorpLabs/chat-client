import { writable, derived, get } from 'svelte/store';
import type { AuthResponse, User } from '../types/auth';
import { refreshToken as apiRefreshToken } from '../api/auth';
import { saveAuthData, loadAuthData, clearAuthData } from '../utils/persistentStore';

interface AuthState {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	user: null,
	token: null,
	isLoading: false,
	error: null
};

export const authStore = writable<AuthState>(initialState);

export const authLoaded = writable(false);

export const isAuthenticated = derived(authStore, $auth => !!$auth.token);

function userFromAuthResponse(data: AuthResponse): User {
	return {
		id: data.id,
		username: data.username,
		email: data.email,
		roles: data.roles
	};
}

let currentAuthData: AuthResponse | null = null;

export async function loadAuth() {
	try {
		const authData = await loadAuthData();
		if (authData) {
			currentAuthData = authData;
			authStore.set({
				user: userFromAuthResponse(authData),
				token: authData.token,
				isLoading: false,
				error: null
			});

			await checkAndRefreshToken();
		}
	} catch (e) {
		await clearAuthData();
		currentAuthData = null;
	}
	authLoaded.set(true);
}

export function logout() {
	clearAuthData();
	currentAuthData = null;
	authStore.set(initialState);
}

let refreshInProgress: Promise<boolean> | null = null;

export async function refreshToken(): Promise<boolean> {
	if (refreshInProgress) {
		return refreshInProgress;
	}

	refreshInProgress = doRefreshToken();
	try {
		return await refreshInProgress;
	} finally {
		refreshInProgress = null;
	}
}

async function doRefreshToken(): Promise<boolean> {
	const token = get(authStore).token;
	if (!token) {
		return false;
	}

	try {
		const refreshedData = await apiRefreshToken(token);

		currentAuthData = refreshedData;
		await saveAuthData(refreshedData);

		authStore.update(state => ({
			...state,
			user: userFromAuthResponse(refreshedData),
			token: refreshedData.token
		}));

		return true;
	} catch (error) {
		logout();
		return false;
	}
}

export async function checkAndRefreshToken(): Promise<boolean> {
	if (!currentAuthData || !currentAuthData.expirationDate) {
		return false;
	}

	const now = Date.now();
	const expiry = new Date(currentAuthData.expirationDate).getTime();

	if (expiry <= now) {
		logout();
		return false;
	}

	const minutesUntilExpiry = (expiry - now) / (1000 * 60);
	if (minutesUntilExpiry <= 2880) {
		return await refreshToken();
	}

	return true;
}

export async function getValidToken(): Promise<string | null> {
	const valid = await checkAndRefreshToken();
	if (!valid) {
		return null;
	}
	return get(authStore).token;
}

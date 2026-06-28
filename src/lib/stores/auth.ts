import { writable, derived } from 'svelte/store';
import type { AuthResponse, User } from '../types/auth';
import { refreshToken as apiRefreshToken } from '../api/auth';

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

export const isAuthenticated = derived(authStore, $auth => !!$auth.token);

export async function loadAuth() {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('auth_data');
		if (saved) {
			try {
				const authData: AuthResponse = JSON.parse(saved);
				const user: User = {
					id: authData.id,
					username: authData.username,
					email: authData.email,
					roles: authData.roles
				};
				authStore.set({
					user,
					token: authData.token,
					isLoading: false,
					error: null
				});

				await checkAndRefreshToken();
			} catch (e) {
				localStorage.removeItem('auth_data');
			}
		}
	}
}

export function logout() {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('auth_data');
	}
	authStore.set(initialState);
}

function isTokenExpiringSoon(expirationDate: string, minutes: number = 30): boolean {
	const now = new Date().getTime();
	const expiry = new Date(expirationDate).getTime();
	const timeUntilExpiry = expiry - now;
	const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);
	return minutesUntilExpiry <= minutes;
}

function getStoredAuthData(): AuthResponse | null {
	if (typeof localStorage === 'undefined') return null;

	const saved = localStorage.getItem('auth_data');
	if (!saved) return null;

	try {
		return JSON.parse(saved) as AuthResponse;
	} catch {
		return null;
	}
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
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.token) {
		return false;
	}

	try {
		const refreshedData = await apiRefreshToken(storedAuth.token);

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('auth_data', JSON.stringify(refreshedData));
		}

		const user: User = {
			id: refreshedData.id,
			username: refreshedData.username,
			email: refreshedData.email,
			roles: refreshedData.roles
		};

		authStore.update(state => ({
			...state,
			user,
			token: refreshedData.token
		}));

		return true;
	} catch (error) {
		logout();
		return false;
	}
}

export async function checkAndRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.expirationDate) {
		return false;
	}

	const now = new Date().getTime();
	const expiry = new Date(storedAuth.expirationDate).getTime();
	if (expiry <= now) {
		logout();
		return false;
	}

	if (isTokenExpiringSoon(storedAuth.expirationDate, 2880)) {
		return await refreshToken();
	}

	return true;
}

export async function getValidToken(): Promise<string | null> {
	const refreshed = await checkAndRefreshToken();
	if (!refreshed) {
		return null;
	}

	const authState = getStoredAuthData();
	return authState?.token || null;
}

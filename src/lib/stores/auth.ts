import { writable, derived } from 'svelte/store';
import type { AuthResponse, User, AuthRequest } from '../types/auth';
import { login as apiLogin, register as apiRegister, refreshToken as apiRefreshToken } from '../api/auth';

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

// Main auth store
export const authStore = writable<AuthState>(initialState);

// Derived store for authentication status
export const isAuthenticated = derived(authStore, $auth => !!$auth.token);

// Load auth data from localStorage on app start
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

// Login function
export async function login(credentials: AuthRequest) {
	authStore.update(state => ({ ...state, isLoading: true, error: null }));

	try {
		const authData = await apiLogin(credentials);

		// Save to localStorage
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('auth_data', JSON.stringify(authData));
		}

		// Update store
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

		return true;
	} catch (error) {
		authStore.update(state => ({
			...state,
			isLoading: false,
			error: 'Login failed'
		}));
		return false;
	}
}

// Register function
export async function register(credentials: AuthRequest) {
	authStore.update(state => ({ ...state, isLoading: true, error: null }));

	try {
		const authData = await apiRegister(credentials);

		// Save to localStorage
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('auth_data', JSON.stringify(authData));
		}

		// Update store
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

		return true;
	} catch (error) {
		authStore.update(state => ({
			...state,
			isLoading: false,
			error: 'Registration failed'
		}));
		return false;
	}
}

// Logout function
export function logout() {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('auth_data');
	}
	authStore.set(initialState);
}

// Utility function to check if token expires within the given minutes
function isTokenExpiringSoon(expirationDate: string, minutes: number = 30): boolean {
	const now = new Date().getTime();
	const expiry = new Date(expirationDate).getTime();
	const timeUntilExpiry = expiry - now;
	const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);
	return minutesUntilExpiry <= minutes;
}

// Get stored auth data from localStorage
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

// Refresh token function
export async function refreshToken(): Promise<boolean> {
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

// Check and refresh token if needed
export async function checkAndRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.expirationDate) {
		return false;
	}

	if (isTokenExpiringSoon(storedAuth.expirationDate, 10)) {
		return await refreshToken();
	}

	return true;
}

// Get a valid token, refreshing if needed
export async function getValidToken(): Promise<string | null> {
	const refreshed = await checkAndRefreshToken();
	if (!refreshed) {
		return null;
	}

	const authState = getStoredAuthData();
	return authState?.token || null;
}
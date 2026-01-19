import { writable, derived } from 'svelte/store';
import type { AuthResponse, User, AuthRequest } from '../types/auth';
import { login as apiLogin } from '../api/auth';

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
export function loadAuth() {
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

// Logout function
export function logout() {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('auth_data');
	}
	authStore.set(initialState);
}
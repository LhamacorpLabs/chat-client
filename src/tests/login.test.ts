import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

const mockGoto = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: any[]) => mockGoto(...args)
}));

vi.mock('$lib/utils/authRedirect', () => ({
	redirectToLogin: vi.fn()
}));

const subscribers = new Set<(value: any) => void>();
let authState = { token: null, user: null, isLoading: false, error: null };

function subscribe(fn: (value: any) => void) {
	fn(authState);
	subscribers.add(fn);
	return () => subscribers.delete(fn);
}

function setAuth(value: any) {
	authState = value;
	subscribers.forEach(fn => fn(authState));
}

const authLoadedSubscribers = new Set<(value: any) => void>();
let authLoadedState = true;

function authLoadedSubscribe(fn: (value: any) => void) {
	fn(authLoadedState);
	authLoadedSubscribers.add(fn);
	return () => authLoadedSubscribers.delete(fn);
}

vi.mock('$lib/stores/auth', () => ({
	authStore: { subscribe },
	authLoaded: { subscribe: authLoadedSubscribe }
}));

import LoginPage from '../routes/login/+page.svelte';
import { redirectToLogin } from '$lib/utils/authRedirect';

beforeEach(() => {
	vi.clearAllMocks();
	setAuth({ token: null, user: null, isLoading: false, error: null });
	localStorage.clear();
});

describe('Login Page', () => {
	it('redirects to auth-ui when not authenticated', () => {
		render(LoginPage);
		expect(redirectToLogin).toHaveBeenCalled();
	});

	it('redirects to home when already authenticated', () => {
		localStorage.setItem('auth_data', JSON.stringify({ token: 'test' }));
		setAuth({ token: 'test-token', user: { username: 'test' }, isLoading: false, error: null });
		render(LoginPage);
		expect(mockGoto).toHaveBeenCalledWith('/');
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

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

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/stores/auth', () => ({
	authStore: { subscribe },
	login: vi.fn(),
	register: vi.fn()
}));

import LoginPage from '../routes/login/+page.svelte';

beforeEach(() => {
	setAuth({ token: null, user: null, isLoading: false, error: null });
});

describe('Login Page', () => {
	it('renders login form by default', () => {
		render(LoginPage);
		expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
		expect(screen.getByText('Sign In')).toBeInTheDocument();
	});

	it('does not show email field in login mode', () => {
		render(LoginPage);
		expect(screen.queryByPlaceholderText('Email (optional)')).not.toBeInTheDocument();
	});

	it('switches to register mode', async () => {
		render(LoginPage);
		const signUpBtn = screen.getByText('Sign up');
		await fireEvent.click(signUpBtn);

		expect(screen.getByText('Create Account')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Email (optional)')).toBeInTheDocument();
	});

	it('switches back to login mode', async () => {
		render(LoginPage);
		await fireEvent.click(screen.getByText('Sign up'));
		await fireEvent.click(screen.getByText('Sign in'));

		expect(screen.getByText('Sign In')).toBeInTheDocument();
		expect(screen.queryByPlaceholderText('Email (optional)')).not.toBeInTheDocument();
	});

	it('shows forgot password button in login mode', () => {
		render(LoginPage);
		expect(screen.getByText('Forgot password?')).toBeInTheDocument();
	});

	it('hides forgot password in register mode', async () => {
		render(LoginPage);
		await fireEvent.click(screen.getByText('Sign up'));
		expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
	});

	it('shows error when forgot password clicked without username', async () => {
		render(LoginPage);
		await fireEvent.click(screen.getByText('Forgot password?'));
		expect(screen.getByText('Enter your username first')).toBeInTheDocument();
	});

	it('clears fields when toggling modes', async () => {
		render(LoginPage);
		const usernameInput = screen.getByPlaceholderText('Username') as HTMLInputElement;
		const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;

		await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
		await fireEvent.input(passwordInput, { target: { value: 'testpass' } });
		await fireEvent.click(screen.getByText('Sign up'));

		expect((screen.getByPlaceholderText('Username') as HTMLInputElement).value).toBe('');
		expect((screen.getByPlaceholderText('Password') as HTMLInputElement).value).toBe('');
	});

	it('renders logo', () => {
		render(LoginPage);
		const logo = screen.getByAltText('Logo');
		expect(logo).toHaveAttribute('src', '/logo.png');
	});
});

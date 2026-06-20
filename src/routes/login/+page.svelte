<script lang="ts">
	import { login, register, authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let username = $state('');
	let password = $state('');
	let email = $state('');
	let isRegisterMode = $state(false);

	$effect(() => {
		if ($authStore.token) {
			goto('/');
		}
	});

	async function handleLogin() {
		await login({ username, password });
	}

	async function handleRegister() {
		await register({ username, password, email });
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (isRegisterMode) {
			handleRegister();
		} else {
			handleLogin();
		}
	}

	function toggleMode() {
		isRegisterMode = !isRegisterMode;
		username = '';
		password = '';
		email = '';
	}
</script>

<div class="login-page">
	<div class="theme-toggle-container">
		<ThemeToggle />
	</div>

	<div class="login-container">
		<div class="login-card fade-in">
			<div class="login-brand">
				<img src="/logo.png" alt="Logo" class="login-logo" />
			</div>

			<form onsubmit={handleSubmit} class="login-form">
				<div class="form-group">
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder="Username"
						required
						autocomplete="username"
					/>
				</div>

				{#if isRegisterMode}
					<div class="form-group">
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Email (optional)"
							autocomplete="email"
						/>
					</div>
				{/if}

				<div class="form-group">
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Password"
						required
						autocomplete={isRegisterMode ? 'new-password' : 'current-password'}
					/>
				</div>

				{#if $authStore.error}
					<div class="login-error">{$authStore.error}</div>
				{/if}

				<button type="submit" class="login-btn" disabled={$authStore.isLoading}>
					{#if $authStore.isLoading}
						<span class="spinner"></span>
					{/if}
					{isRegisterMode ? 'Create Account' : 'Sign In'}
				</button>
			</form>

			<div class="login-footer">
				<span>{isRegisterMode ? 'Have an account?' : "Don't have an account?"}</span>
				<button type="button" class="link-btn" onclick={toggleMode}>
					{isRegisterMode ? 'Sign in' : 'Sign up'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.login-page {
		height: 100vh;
		height: 100dvh;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.theme-toggle-container {
		position: fixed;
		top: 1.25rem;
		right: 1.25rem;
		z-index: 10;
	}

	.login-container {
		width: 100%;
		max-width: 340px;
		padding: 2rem;
	}

	.login-card {
		text-align: center;
	}

	.login-brand {
		margin-bottom: 2rem;
	}

	.login-logo {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.375rem;
		letter-spacing: -0.03em;
	}

	.login-subtitle {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin: 0 0 2rem;
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group input {
		width: 100%;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1.5px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		color: var(--text-primary);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-subtle);
		background: var(--bg-primary);
	}

	.form-group input::placeholder {
		color: var(--text-muted);
	}

	.login-error {
		font-size: 0.8125rem;
		color: var(--danger);
		background: rgba(239, 68, 68, 0.06);
		border: 1px solid rgba(239, 68, 68, 0.15);
		border-radius: var(--radius-sm);
		padding: 0.625rem 0.875rem;
		text-align: left;
	}

	.login-btn {
		width: 100%;
		padding: 0.75rem 1.25rem;
		margin-top: 0.5rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease, transform 0.1s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.login-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.login-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: white;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.login-footer {
		margin-top: 1.75rem;
		font-size: 0.8125rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}

	.link-btn:hover {
		color: var(--accent-hover);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	@media (max-width: 768px) {
		.login-container {
			max-width: 100%;
			padding: 1.5rem;
		}

		.theme-toggle-container {
			top: 1rem;
			right: 1rem;
		}
	}
</style>

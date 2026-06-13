<script lang="ts">
	import { login, register, authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let username = $state('');
	let password = $state('');
	let email = $state('');
	let isRegisterMode = $state(false);

	// Reactive statement: redirect to main page when authenticated
	$effect(() => {
		if ($authStore.token) {
			goto('/');
		}
	});

	async function handleLogin() {
		const success = await login({ username, password });
		// No need for manual redirect here since $effect will handle it
	}

	async function handleRegister() {
		const success = await register({ username, password, email });
		// No need for manual redirect here since $effect will handle it
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
		// Clear form fields when switching modes
		username = '';
		password = '';
		email = '';
		// Clear any existing errors when switching modes
		// Note: We can't directly update the store here, but the error will clear on next form submission
	}
</script>

<div class="login-page">
	<div class="theme-toggle-container">
		<ThemeToggle />
	</div>

	<div class="login-container">
		<div class="login-card card fade-in">
			<div class="login-header">
				<div class="login-title">
					<img src="/logo.png" alt="Lhama Chat Logo" class="login-logo" />
					<h1>Lhama Chat</h1>
				</div>
			</div>

			<form onsubmit={handleSubmit} class="login-form">
				<div class="form-group">
					<label for="username">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder="Enter your username"
						required
					/>
				</div>

				{#if isRegisterMode}
					<div class="form-group">
						<label for="email">Email (Optional)</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Enter your email"
						/>
					</div>
				{/if}

				<div class="form-group">
					<label for="password">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Enter your password"
						required
					/>
				</div>

				{#if $authStore.error}
					<div class="alert alert-error">{$authStore.error}</div>
				{/if}

				<button type="submit" class="btn btn-primary" disabled={$authStore.isLoading}>
					{#if $authStore.isLoading}
						<span class="loading-spinner"></span>
						{isRegisterMode ? 'Creating account...' : 'Signing in...'}
					{:else}
						{isRegisterMode ? 'Create Account' : 'Sign In'}
					{/if}
				</button>

				<div class="mode-toggle">
					{#if isRegisterMode}
						<p>Already have an account? <button type="button" class="link-button" onclick={toggleMode}>Sign in</button></p>
					{:else}
						<p>Don't have an account? <button type="button" class="link-button" onclick={toggleMode}>Create account</button></p>
					{/if}
				</div>
			</form>
		</div>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--bg-primary);
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.theme-toggle-container {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		z-index: 10;
	}

	.login-container {
		display: flex;
		justify-content: center;
		align-items: center;
		flex: 1;
		padding: 2rem;
	}

	.login-card {
		width: 100%;
		max-width: 380px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-xl);
		padding: 0;
		overflow: hidden;
		box-shadow: 0 4px 24px var(--shadow-elevated);
	}

	.login-header {
		background: var(--bg-secondary);
		padding: 2rem 1.5rem;
		text-align: center;
		border-bottom: 1px solid var(--border-color);
	}

	.login-title {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-bottom: 0;
	}

	.login-logo {
		width: 36px;
		height: 36px;
		object-fit: contain;
	}

	.login-header h1 {
		color: var(--text-primary);
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.login-header p {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin: 0;
	}

	.login-form {
		padding: 1.75rem;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		color: var(--text-secondary);
		font-weight: 500;
		font-size: 0.8125rem;
	}

	input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: var(--bg-secondary);
		border: 1.5px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		transition: all 0.15s ease;
	}

	input:focus {
		border-color: var(--accent);
		background: var(--bg-primary);
		box-shadow: 0 0 0 3px var(--accent-subtle);
	}

	.btn {
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.625rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 500;
		border-radius: var(--radius-md);
	}

	.loading-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: white;
		animation: spin 0.8s linear infinite;
		margin-right: 0.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.mode-toggle {
		text-align: center;
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border-color);
	}

	.mode-toggle p {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.link-button {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.link-button:hover {
		color: var(--accent-hover);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.link-button:focus {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 3px;
	}

	.demo-info {
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		padding: 1.25rem;
		margin-top: 1.5rem;
		text-align: center;
		border: 1px solid var(--border-color);
	}

	.demo-info p {
		margin: 0.25rem 0;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.demo-info strong {
		color: var(--text-primary);
	}

	.demo-info code {
		background: var(--bg-tertiary);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
		font-size: 0.8rem;
		color: var(--accent);
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.theme-toggle-container {
			top: 1rem;
			right: 1rem;
		}

		.login-container {
			padding: 1rem;
		}

		.login-card {
			max-width: 100%;
			box-shadow: none;
			border: 1px solid var(--border-color);
		}

		.login-header {
			padding: 1.5rem 1.25rem;
		}

		.login-logo {
			width: 32px;
			height: 32px;
		}

		.login-form {
			padding: 1.5rem;
		}

		.login-header h1 {
			font-size: 1.375rem;
		}
	}
</style>
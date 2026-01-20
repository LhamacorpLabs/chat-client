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
				<p>{isRegisterMode ? 'Create your account' : 'Welcome back'}</p>
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
		background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
		position: relative;
	}

	.theme-toggle-container {
		position: absolute;
		top: 2rem;
		right: 2rem;
		z-index: 10;
	}

	.login-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 2rem;
	}

	.login-card {
		width: 100%;
		max-width: 440px;
		background: var(--bg-primary);
		border: 1px solid var(--border-light);
		border-radius: 16px;
		padding: 0;
		overflow: hidden;
	}

	.login-header {
		background: var(--gradient);
		color: white;
		padding: 2.5rem 2rem;
		text-align: center;
	}

	.login-title {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.login-logo {
		width: 40px;
		height: 40px;
		object-fit: contain;
	}

	.login-header h1 {
		color: white;
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.login-header p {
		color: rgba(255, 255, 255, 0.9);
		font-size: 1.1rem;
		margin: 0;
	}

	.login-form {
		padding: 2rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.75rem;
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	input {
		width: 100%;
		padding: 1rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		font-size: 1rem;
		transition: all 0.3s ease;
	}

	input:focus {
		border-color: var(--accent);
		background: var(--bg-primary);
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 123, 255, 0.15);
	}

	.btn {
		width: 100%;
		margin-top: 1rem;
		padding: 1rem 2rem;
		font-size: 1.1rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-radius: 12px;
	}

	.loading-spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: white;
		animation: spin 1s ease-in-out infinite;
		margin-right: 0.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.mode-toggle {
		text-align: center;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-light);
	}

	.mode-toggle p {
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin: 0;
	}

	.link-button {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: color 0.2s ease;
	}

	.link-button:hover {
		color: var(--accent-hover, var(--accent));
		text-decoration: none;
	}

	.link-button:focus {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 3px;
	}

	.demo-info {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.5rem;
		margin-top: 2rem;
		text-align: center;
		border: 1px solid var(--border-light);
	}

	.demo-info p {
		margin: 0.25rem 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.demo-info strong {
		color: var(--text-primary);
	}

	.demo-info code {
		background: var(--bg-tertiary);
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.85rem;
		color: var(--accent);
		font-weight: 600;
	}

	/* Responsive design */
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
		}

		.login-header {
			padding: 2rem 1.5rem;
		}

		.login-title {
			gap: 0.75rem;
		}

		.login-logo {
			width: 36px;
			height: 36px;
		}

		.login-form {
			padding: 1.5rem;
		}

		.login-header h1 {
			font-size: 1.75rem;
		}
	}
</style>
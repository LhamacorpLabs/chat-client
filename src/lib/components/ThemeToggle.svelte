<script lang="ts">
	import { theme, toggleTheme } from '$lib/stores/theme';
</script>

<button
	class="theme-toggle"
	on:click={toggleTheme}
	title="Toggle theme"
	aria-label="Toggle between light and dark theme"
>
	<div class="theme-toggle-slider">
		{$theme === 'dark' ? '🌙' : '☀️'}
	</div>
</button>

<style>
	.theme-toggle {
		position: relative;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 50px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.3s ease;
		width: 60px;
		height: 32px;
		display: flex;
		align-items: center;
	}

	.theme-toggle:hover {
		border-color: var(--accent);
		transform: scale(1.05);
	}

	.theme-toggle-slider {
		position: absolute;
		width: 20px;
		height: 20px;
		background: var(--accent);
		border-radius: 50%;
		transition: transform 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		left: 6px;
	}

	:global([data-theme='dark']) .theme-toggle-slider {
		transform: translateX(28px);
	}
</style>
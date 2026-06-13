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
		background: var(--bg-tertiary);
		border: 1.5px solid var(--border-color);
		border-radius: 50px;
		padding: 0.25rem;
		cursor: pointer;
		transition: all 0.2s ease;
		width: 52px;
		height: 28px;
		display: flex;
		align-items: center;
	}

	.theme-toggle:hover {
		border-color: var(--accent);
	}

	.theme-toggle-slider {
		position: absolute;
		width: 20px;
		height: 20px;
		background: var(--accent);
		border-radius: 50%;
		transition: transform 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		left: 3px;
	}

	:global([data-theme='dark']) .theme-toggle-slider {
		transform: translateX(24px);
	}
</style>
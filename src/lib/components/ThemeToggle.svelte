<script lang="ts">
	import { theme, toggleTheme } from '$lib/stores/theme';
</script>

<button
	class="theme-toggle"
	on:click={toggleTheme}
	title="Toggle theme"
	aria-label="Toggle between light and dark theme"
>
	{$theme === 'dark' ? '☀️' : '🌙'}
</button>

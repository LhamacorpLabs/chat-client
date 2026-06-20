<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAuth } from '$lib/stores/auth';
	import { loadTheme } from '$lib/stores/theme';
	import { checkAndRefreshIfNewDay } from '$lib/utils/dailyRefresh';

	let { children } = $props();

	onMount(async () => {
		// Check if it's a new day and refresh if needed
		// This must happen first, before any other initialization
		if (checkAndRefreshIfNewDay()) {
			return; // Refresh triggered, code won't execute after reload
		}

		// Load theme first (for immediate visual feedback)
		loadTheme();
		// Then load auth data and check token
		await loadAuth();
	});
</script>

<svelte:head>
	<title>Chat</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

{@render children()}

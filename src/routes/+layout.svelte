<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAuth } from '$lib/stores/auth';
	import { loadTheme } from '$lib/stores/theme';

	let { children } = $props();

	onMount(async () => {
		// Load theme first (for immediate visual feedback)
		loadTheme();
		// Then load auth data and check token
		await loadAuth();
	});
</script>

<svelte:head>
	<title>Lhama Chat</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

{@render children()}

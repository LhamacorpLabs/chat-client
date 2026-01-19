<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAuth } from '$lib/stores/auth';
	import { loadTheme } from '$lib/stores/theme';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		// Load theme first (for immediate visual feedback)
		loadTheme();
		// Then load auth data
		loadAuth();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

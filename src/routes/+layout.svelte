<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAuth } from '$lib/stores/auth';
	import { loadTheme } from '$lib/stores/theme';
	import { checkAndRefreshIfNewDay } from '$lib/utils/dailyRefresh';
	import { checkAndInstallUpdate } from '$lib/utils/updater';

	let { children } = $props();

	onMount(async () => {
		if (checkAndRefreshIfNewDay()) {
			return;
		}

		loadTheme();
		await loadAuth();
		checkAndInstallUpdate();
	});
</script>

<svelte:head>
	<title>Chat</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

{@render children()}

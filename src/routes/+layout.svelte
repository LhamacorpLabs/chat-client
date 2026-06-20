<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAuth } from '$lib/stores/auth';
	import { loadTheme } from '$lib/stores/theme';
	import { checkAndRefreshIfNewDay } from '$lib/utils/dailyRefresh';
	import { startUpdateChecker } from '$lib/utils/updater';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();

	onMount(async () => {
		if (checkAndRefreshIfNewDay()) {
			return;
		}

		loadTheme();
		await loadAuth();
		startUpdateChecker();
	});
</script>

<svelte:head>
	<title>Chat</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

<UpdateBanner />
{@render children()}

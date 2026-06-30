<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, authLoaded } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { redirectToLogin } from '$lib/utils/authRedirect';

	onMount(() => {
		if ($authLoaded && $authStore.token) {
			goto('/');
		} else {
			redirectToLogin();
		}
	});
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

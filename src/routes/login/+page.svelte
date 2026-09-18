<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { redirectToLogin } from '$lib/utils/authRedirect';

	onMount(() => {
		const saved = localStorage.getItem('auth_data');
		if (saved && $authStore.token) {
			goto(resolve('/'));
		} else {
			redirectToLogin();
		}
	});
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

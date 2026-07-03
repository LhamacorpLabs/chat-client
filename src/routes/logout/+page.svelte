<script lang="ts">
	import { onMount } from 'svelte';
	import { redirectToLogin } from '$lib/utils/authRedirect';
	import { logout } from '$lib/stores/auth';

	onMount(() => {
		logout();
		redirectToLogin();
	});
</script>

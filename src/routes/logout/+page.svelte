<script lang="ts">
	import { onMount } from 'svelte';
	import { redirectToLogin } from '$lib/utils/authRedirect';

	onMount(() => {
		localStorage.removeItem('auth_data');
		redirectToLogin();
	});
</script>

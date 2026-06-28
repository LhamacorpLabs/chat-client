<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import type { AuthResponse, User } from '$lib/types/auth';

	onMount(() => {
		const hash = new URLSearchParams(window.location.hash.slice(1));
		const token = hash.get('token');
		const username = hash.get('username');
		const expires = hash.get('expires');

		if (token && username) {
			const authData: AuthResponse = {
				id: '',
				username,
				email: '',
				roles: [],
				token,
				expirationDate: expires || ''
			};

			localStorage.setItem('auth_data', JSON.stringify(authData));

			const user: User = {
				id: '',
				username,
				email: '',
				roles: []
			};

			authStore.set({
				user,
				token,
				isLoading: false,
				error: null
			});

			window.location.hash = '';
			goto('/');
		} else {
			goto('/login');
		}
	});
</script>

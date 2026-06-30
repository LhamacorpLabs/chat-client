<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, refreshToken } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import type { AuthResponse } from '$lib/types/auth';
	import { saveAuthData } from '$lib/utils/persistentStore';

	onMount(async () => {
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

			await saveAuthData(authData);

			authStore.set({
				user: { id: '', username, email: '', roles: [] },
				token,
				isLoading: false,
				error: null
			});

			window.location.hash = '';

			await refreshToken();

			goto('/');
		} else {
			goto('/login');
		}
	});
</script>

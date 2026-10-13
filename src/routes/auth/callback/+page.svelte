<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, refreshToken } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AuthResponse, User } from '$lib/types/auth';
	import { persistAuthData, clearRefreshToken } from '$lib/utils/persistentStore';

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

			// A refresh token left over from a previous account must not be used
			// for this login; refreshToken() below starts a fresh session.
			await clearRefreshToken();

			localStorage.setItem('auth_data', JSON.stringify(authData));
			await persistAuthData(authData);

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

			// Starts the refreshable session and fetches the full profile (id, email, roles)
			await refreshToken();

			goto(resolve('/'));
		} else {
			goto(resolve('/login'));
		}
	});
</script>

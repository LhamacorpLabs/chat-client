<script lang="ts">
	import { avatars, ensureAvatar } from '$lib/stores/avatars';

	interface Props {
		userId?: string | null;
		name: string;
	}

	let { userId = null, name }: Props = $props();

	$effect(() => {
		ensureAvatar(userId);
	});

	const url = $derived(userId ? $avatars[userId] : null);
</script>

{#if url}
	<img class="avatar-image" src={url} alt="" />
{:else}
	{name.charAt(0).toUpperCase()}
{/if}

<style>
	.avatar-image {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		object-fit: cover;
	}
</style>

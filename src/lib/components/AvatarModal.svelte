<script lang="ts">
	import { authStore, getValidToken } from '$lib/stores/auth';
	import { avatars, refreshAvatar } from '$lib/stores/avatars';
	import { uploadAvatar, removeAvatar } from '$lib/api/auth';
	import { validateImageFile } from '$lib/utils/fileValidation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let dragging = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const userId = $derived($authStore.user?.id ?? null);
	const username = $derived($authStore.user?.username || '?');
	const hasAvatar = $derived(!!(userId && $avatars[userId]));

	$effect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	});

	function choose(candidate: File | undefined) {
		error = null;
		if (!candidate) return;

		const result = validateImageFile(candidate);
		if (!result.isValid) {
			error =
				result.error?.type === 'too_large'
					? 'That image is larger than 1 MB.'
					: 'Please choose a JPEG, PNG or GIF image.';
			return;
		}

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		file = candidate;
		previewUrl = URL.createObjectURL(candidate);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		choose(event.dataTransfer?.files[0]);
	}

	async function run(action: (token: string) => Promise<void>) {
		busy = true;
		error = null;
		try {
			const token = await getValidToken();
			if (!token) throw new Error('Your session has expired. Please sign in again.');
			await action(token);
			if (userId) refreshAvatar(userId);
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not update your profile picture.';
		} finally {
			busy = false;
		}
	}

	const save = () => file && run((token) => uploadAvatar(token, file!));
	const remove = () => run((token) => removeAvatar(token));
</script>

<Modal title="Profile picture" description="Shown next to your name in every chat." {onClose}>
	<div class="avatar-modal">
		<button
			type="button"
			class="drop"
			class:dragging
			onclick={() => fileInput?.click()}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
			disabled={busy}
			aria-label="Choose a profile picture. You can also drop an image here."
		>
			<span class="preview">
				{#if previewUrl}
					<img src={previewUrl} alt="" />
				{:else}
					<Avatar {userId} name={username} />
				{/if}
			</span>
			<span class="drop-text">
				<strong>{file ? file.name : hasAvatar ? 'Replace your picture' : 'Choose an image'}</strong>
				<span>{file ? 'Click to pick a different file' : 'or drop one here'}</span>
			</span>
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/gif"
			hidden
			onchange={(e) => choose(e.currentTarget.files?.[0])}
		/>

		<p class="hint">JPEG, PNG or GIF up to 1 MB. It is cropped to a square from the centre.</p>

		{#if error}
			<div class="alert alert-error" role="alert">{error}</div>
		{/if}

		<div class="actions">
			{#if hasAvatar && !file}
				<button type="button" class="btn btn-ghost remove" onclick={remove} disabled={busy}>
					Remove picture
				</button>
			{/if}
			<button type="button" class="btn btn-ghost" onclick={onClose} disabled={busy}>Cancel</button>
			<button type="button" class="btn btn-primary" onclick={save} disabled={busy || !file}>
				{busy ? 'Saving…' : 'Save picture'}
			</button>
		</div>
	</div>
</Modal>

<style>
	.avatar-modal {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.drop {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 1rem;
		text-align: left;
		color: inherit;
		font: inherit;
		background: var(--surface-alt, transparent);
		border: 1.5px dashed var(--border, currentColor);
		border-radius: 12px;
		cursor: pointer;
	}

	.drop:hover:not(:disabled),
	.drop:focus-visible,
	.drop.dragging {
		border-color: var(--accent);
		outline: none;
	}

	.preview {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		overflow: hidden;
		border-radius: 50%;
		font-size: 1.75rem;
		font-weight: 650;
		color: #fff;
		background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #ff6fa8));
	}

	.preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.drop-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.drop-text strong {
		overflow: hidden;
		font-size: 0.9375rem;
		font-weight: 550;
		color: var(--text-primary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.remove {
		margin-right: auto;
	}
</style>

<script lang="ts">
	import { authStore } from '$lib/stores/auth';

	// Global icon-only nav rail, introduced alongside the v2 (COSMIC)
	// design tokens. Only "Chats" is a real destination today; the rest
	// of the app's surface (contacts, notifications, settings) doesn't
	// exist yet, so those buttons are real `disabled` elements rather
	// than dead-but-clickable ones - remove `disabled` as each section
	// ships instead of wiring up placeholder routes.
	const initial = $derived(($authStore.user?.username ?? '?').charAt(0).toUpperCase());
</script>

<nav class="rail" aria-label="Primary">
	<div class="rail-mark">
		<img src="/logo.png" alt="" />
	</div>

	<a class="rail-btn active" href="/" title="Chats" aria-current="page">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-4 4v-4H6.5A2.5 2.5 0 014 13.5v-8z"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linejoin="round"
			/>
		</svg>
	</a>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Contacts (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7" />
			<path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
		</svg>
	</button>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Notifications (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linejoin="round"
			/>
			<path d="M9.5 18.5a2.5 2.5 0 005 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
		</svg>
	</button>

	<div class="rail-spacer"></div>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Settings (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" />
			<path
				d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	<div class="rail-avatar" title={$authStore.user?.username ?? ''} aria-hidden="true">{initial}</div>
</nav>

<style>
	.rail {
		width: var(--rail-width, 56px);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--rail-icon-gap, 4px);
		padding: 12px 0;
		background: var(--rail-bg, #000);
		border-radius: var(--radius-lg);
	}

	.rail-mark {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		overflow: hidden;
		margin-bottom: 8px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-subtle, rgba(255, 255, 255, 0.08));
	}

	.rail-mark img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.rail-btn {
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		border-radius: var(--rail-icon-radius, 999px);
		border: none;
		background: transparent;
		color: var(--rail-icon-color, var(--text-secondary));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		text-decoration: none;
		transition: background var(--duration-base, 0.15s) var(--ease-standard, ease),
			color var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.rail-btn svg {
		width: 16px;
		height: 16px;
	}

	.rail-btn:hover:not(:disabled) {
		background: var(--rail-icon-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--text-primary);
	}

	.rail-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.rail-btn.active {
		background: var(--rail-icon-bg-active, #fff);
		color: var(--rail-icon-color-active, #000);
	}

	.rail-spacer {
		flex: 1;
	}

	.rail-avatar {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent-contrast, #fff);
		background: var(--accent, #7c6fee);
	}
</style>

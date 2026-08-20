<script lang="ts">
	import { requestNotificationPermission, getNotificationPermission, canShowNotifications } from '$lib/utils/osNotification';

	let permissionStatus = getNotificationPermission();
	let isRequesting = false;

	async function enableNotifications() {
		if (isRequesting) return;

		isRequesting = true;
		try {
			const result = await requestNotificationPermission();
			permissionStatus = result;
		} finally {
			isRequesting = false;
		}
	}

	function getStatusMessage() {
		switch (permissionStatus) {
			case 'granted':
				return 'Notifications are enabled ✅';
			case 'denied':
				return 'Notifications are blocked. You can enable them in your browser settings.';
			case 'default':
			default:
				return 'Enable notifications to get alerts for new messages';
		}
	}

	function getStatusColor() {
		switch (permissionStatus) {
			case 'granted':
				return 'status-success';
			case 'denied':
				return 'status-error';
			case 'default':
			default:
				return 'status-muted';
		}
	}
</script>

<div class="card notification-settings">
	<div class="settings-row">
		<div>
			<h3>Desktop Notifications</h3>
			<p class="status-text {getStatusColor()}">{getStatusMessage()}</p>
		</div>

		{#if permissionStatus === 'default'}
			<button
				on:click={enableNotifications}
				disabled={isRequesting}
				class="btn btn-primary"
			>
				{#if isRequesting}
					Requesting...
				{:else}
					Enable Notifications
				{/if}
			</button>
		{:else if permissionStatus === 'denied'}
			<button
				on:click={() => {
					alert('To enable notifications:\n\n1. Click the lock icon in your address bar\n2. Change notifications from "Block" to "Allow"\n3. Refresh the page');
				}}
				class="btn btn-ghost"
			>
				Help
			</button>
		{/if}
	</div>
</div>

<style>
	.notification-settings {
		display: block;
	}

	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.notification-settings h3 {
		margin: 0 0 0.25rem;
		font-size: var(--font-lg);
	}

	.status-text {
		margin: 0;
		font-size: var(--font-sm);
	}

	.status-success {
		color: var(--success-text);
	}

	.status-error {
		color: var(--error-text);
	}

	.status-muted {
		color: var(--text-secondary);
	}
</style>
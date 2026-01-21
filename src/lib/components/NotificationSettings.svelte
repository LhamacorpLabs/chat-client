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
				return 'text-green-600';
			case 'denied':
				return 'text-red-600';
			case 'default':
			default:
				return 'text-gray-600';
		}
	}
</script>

<div class="bg-white rounded-lg shadow p-4 border">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold text-gray-900">Desktop Notifications</h3>
			<p class="text-sm {getStatusColor()}">{getStatusMessage()}</p>
		</div>

		{#if permissionStatus === 'default'}
			<button
				on:click={enableNotifications}
				disabled={isRequesting}
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
				class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
			>
				Help
			</button>
		{/if}
	</div>
</div>
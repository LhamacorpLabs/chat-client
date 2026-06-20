export async function checkAndInstallUpdate() {
	if (!('__TAURI_INTERNALS__' in window)) return;

	try {
		const { check } = await import('@tauri-apps/plugin-updater');
		const { relaunch } = await import('@tauri-apps/plugin-process');

		const update = await check();
		if (!update) return;

		await update.downloadAndInstall();
		await relaunch();
	} catch (e) {
		console.error('Auto-update failed:', e);
	}
}

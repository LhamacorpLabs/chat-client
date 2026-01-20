/**
 * Plays a notification sound using Web Audio API
 * Creates a simple beep sound (800Hz, 0.1 seconds)
 */
export function playNotificationSound(): void {
	try {
		// Create a simple notification beep using Web Audio API
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
		gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + 0.1);
	} catch (error) {
		console.warn('Could not play notification sound:', error);
	}
}

/**
 * Checks if the browser window is currently focused
 * Used to determine whether to play notification sounds
 */
export function isWindowFocused(): boolean {
	return !document.hidden && document.hasFocus();
}
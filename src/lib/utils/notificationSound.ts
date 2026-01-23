let audioContext: AudioContext | null = null;

/**
 * Gets or creates the singleton AudioContext
 */
function getAudioContext(): AudioContext {
	if (!audioContext || audioContext.state === 'closed') {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
	}
	return audioContext;
}

/**
 * Closes the AudioContext to free memory (call on app shutdown)
 */
export function closeAudioContext(): void {
	if (audioContext && audioContext.state !== 'closed') {
		audioContext.close();
		audioContext = null;
	}
}

/**
 * Plays a notification sound using Web Audio API
 * Creates a simple beep sound (800Hz, 0.1 seconds)
 * Uses a singleton AudioContext to prevent memory leaks
 */
export function playNotificationSound(): void {
	try {
		// Get the singleton AudioContext
		const ctx = getAudioContext();
		const oscillator = ctx.createOscillator();
		const gainNode = ctx.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(ctx.destination);

		oscillator.frequency.setValueAtTime(800, ctx.currentTime);
		gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

		oscillator.start(ctx.currentTime);
		oscillator.stop(ctx.currentTime + 0.1);
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
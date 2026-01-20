/**
 * Utility function to detect HTTPS links in text and convert them to clickable HTML links,
 * and replace emoji shortcuts with Unicode emojis
 */

// Regex pattern to detect HTTPS URLs
const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

/**
 * Converts HTTPS URLs in text to clickable HTML links with confirmation
 * and replaces emoji shortcuts with Unicode emojis
 * @param text - The input text that may contain HTTPS URLs and emoji shortcuts
 * @returns HTML string with clickable links and emojis
 */
export function linkify(text: string): string {
	// Escape HTML special characters to prevent XSS
	const escapedText = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');

	// Replace simple emoji shortcuts with Unicode emojis
	const withEmojis = escapedText
		.replace(/:\)/g, '🙂')
		.replace(/:P/g, '😛')
		.replace(/:O/g, '😲')
		.replace(/:kiss:/g, '😘')
		.replace(/:D/g, '😃')
		.replace(/:thinking:/g, '🤔')
		.replace(/:evil:/g, '😈');

	// Replace HTTPS URLs with clickable links that show confirmation
	return withEmojis.replace(HTTPS_URL_REGEX, (url) => {
		// Additional validation to ensure the URL is well-formed
		try {
			new URL(url);
			return `<a href="#" onclick="window.showLinkConfirmation && window.showLinkConfirmation('${url.replace(/'/g, '\\\'')}')" class="message-link">${url}</a>`;
		} catch {
			// If URL parsing fails, return the original text
			return url;
		}
	});
}
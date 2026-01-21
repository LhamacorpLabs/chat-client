export interface ParsedReplyMessage {
	replyToId: string | null;
	text: string;
	imageIds: string[];
}

/**
 * Parses a message content to extract reply reference, text, and image references
 * Format: "reply:messageId\ntext content\nimage:imageId1\nimage:imageId2"
 */
export function parseReplyMessage(content: string): ParsedReplyMessage {
	if (!content) {
		return { replyToId: null, text: '', imageIds: [] };
	}

	const lines = content.split('\n');
	let replyToId: string | null = null;
	const textLines: string[] = [];
	const imageIds: string[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();

		// Extract reply reference (only first occurrence)
		if (trimmedLine.startsWith('reply:') && !replyToId) {
			const extractedId = trimmedLine.substring(6).trim();
			if (extractedId) {
				replyToId = extractedId;
			}
		} else if (trimmedLine.startsWith('image:')) {
			// Extract image ID
			const imageId = trimmedLine.substring(6).trim();
			if (imageId) {
				imageIds.push(imageId);
			}
		} else if (trimmedLine) {
			// Regular text line
			textLines.push(trimmedLine);
		}
	}

	return {
		replyToId,
		text: textLines.join('\n').trim(),
		imageIds
	};
}

/**
 * Checks if a message contains a reply reference
 */
export function hasReply(content: string): boolean {
	return content.includes('reply:');
}

/**
 * Formats a message with reply reference and optional images
 * Returns: "reply:messageId\ntext content\nimage:imageId1"
 */
export function formatReplyMessage(
	replyToId: string,
	text: string,
	imageIds: string[] = []
): string {
	const parts: string[] = [];

	// Add reply reference
	parts.push(`reply:${replyToId}`);

	// Add text if present
	if (text.trim()) {
		parts.push(text);
	}

	// Add image references
	for (const imageId of imageIds) {
		parts.push(`image:${imageId}`);
	}

	return parts.join('\n');
}

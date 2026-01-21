export interface ParsedMessage {
	text: string;
	imageIds: string[];
}

/**
 * Parses a message content to extract text and image references
 * Format: "text content\nimage:imageId1\nimage:imageId2"
 */
export function parseImageMessage(content: string): ParsedMessage {
	if (!content) {
		return { text: '', imageIds: [] };
	}

	const lines = content.split('\n');
	const textLines: string[] = [];
	const imageIds: string[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine.startsWith('image:')) {
			const imageId = trimmedLine.substring(6);
			if (imageId) {
				imageIds.push(imageId);
			}
		} else if (trimmedLine) {
			textLines.push(trimmedLine);
		}
	}

	return {
		text: textLines.join('\n').trim(),
		imageIds
	};
}

/**
 * Checks if a message contains image references
 */
export function hasImages(content: string): boolean {
	return content.includes('image:');
}


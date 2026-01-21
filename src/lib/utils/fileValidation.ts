export const ALLOWED_IMAGE_TYPES = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif'
] as const;

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

export interface FileValidationError {
	type: 'invalid_type' | 'too_large' | 'no_file';
	message: string;
}

export interface FileValidationResult {
	isValid: boolean;
	error?: FileValidationError;
}

/**
 * Validates an image file against allowed types and size constraints
 */
export function validateImageFile(file: File): FileValidationResult {
	if (!file) {
		return {
			isValid: false,
			error: {
				type: 'no_file',
				message: 'No file selected'
			}
		};
	}

	// Check file type
	if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
		return {
			isValid: false,
			error: {
				type: 'invalid_type',
				message: `Invalid file type. Only ${ALLOWED_IMAGE_TYPES.join(', ')} are allowed.`
			}
		};
	}

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
		const maxSizeInMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
		return {
			isValid: false,
			error: {
				type: 'too_large',
				message: `File too large (${sizeInMB}MB). Maximum size is ${maxSizeInMB}MB. Note: Server may have lower limits.`
			}
		};
	}

	return { isValid: true };
}


/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
<script lang="ts">
	import { validateImageFile, type FileValidationError, formatFileSize } from '../utils/fileValidation';

	interface Props {
		onFilesSelected: (files: File[]) => void;
		maxFiles?: number;
		disabled?: boolean;
		selectedFiles?: File[];
		onRemoveFile?: (index: number) => void;
	}

	let {
		onFilesSelected,
		maxFiles = 5,
		disabled = false,
		selectedFiles = [],
		onRemoveFile
	}: Props = $props();

	let fileInput: HTMLInputElement;
	let dragOver = $state(false);
	let validationErrors = $state<{file: string; error: FileValidationError}[]>([]);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			processFiles(Array.from(target.files));
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files) {
			processFiles(Array.from(event.dataTransfer.files));
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	function processFiles(files: File[]) {
		validationErrors = [];
		const validFiles: File[] = [];
		const errors: {file: string; error: FileValidationError}[] = [];

		// Validate each file
		files.forEach(file => {
			const validation = validateImageFile(file);
			if (validation.isValid) {
				validFiles.push(file);
			} else if (validation.error) {
				errors.push({ file: file.name, error: validation.error });
			}
		});

		// Check if adding these files would exceed max limit
		const totalFiles = selectedFiles.length + validFiles.length;
		if (totalFiles > maxFiles) {
			const allowedCount = maxFiles - selectedFiles.length;
			const truncatedFiles = validFiles.slice(0, allowedCount);

			if (allowedCount > 0) {
				onFilesSelected(truncatedFiles);
			}

			errors.push({
				file: 'Multiple files',
				error: {
					type: 'too_large',
					message: `Can only upload ${maxFiles} images at once. Selected first ${allowedCount} valid files.`
				}
			});
		} else if (validFiles.length > 0) {
			onFilesSelected(validFiles);
		}

		validationErrors = errors;

		// Clear input for next selection
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function triggerFileSelect() {
		if (!disabled) {
			fileInput?.click();
		}
	}

	function removeFile(index: number) {
		if (onRemoveFile) {
			onRemoveFile(index);
		}
	}

	function getFilePreviewUrl(file: File): string {
		return URL.createObjectURL(file);
	}

	// Cleanup object URLs when component is destroyed
	$effect(() => {
		return () => {
			selectedFiles.forEach(file => {
				const url = getFilePreviewUrl(file);
				URL.revokeObjectURL(url);
			});
		};
	});
</script>

<!-- Hidden file input -->
<input
	bind:this={fileInput}
	type="file"
	multiple
	accept="image/jpeg,image/jpg,image/png,image/gif"
	onchange={handleFileSelect}
	style="display: none;"
/>

<!-- Upload area -->
<div class="image-upload-container">
	{#if selectedFiles.length > 0}
		<!-- File previews -->
		<div class="file-previews">
			{#each selectedFiles as file, index}
				<div class="file-preview">
					<div class="preview-image">
						<img src={getFilePreviewUrl(file)} alt={file.name} />
						<button
							class="remove-file-btn"
							onclick={() => removeFile(index)}
							title="Remove image"
						>
							×
						</button>
					</div>
					<div class="file-info">
						<div class="file-name">{file.name}</div>
						<div class="file-size">{formatFileSize(file.size)}</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Upload button/drop zone -->
	<div
		class="upload-zone {dragOver ? 'drag-over' : ''} {disabled ? 'disabled' : ''}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		onclick={triggerFileSelect}
	>
		<div class="upload-content">
			<div class="upload-icon">+</div>
			<div class="upload-text">
				{#if selectedFiles.length === 0}
					Click or drag images here
				{:else}
					Add more images ({selectedFiles.length}/{maxFiles})
				{/if}
			</div>
			<div class="upload-subtext">
				JPEG, PNG, GIF • Max 1MB each
			</div>
		</div>
	</div>

	<!-- Validation errors -->
	{#if validationErrors.length > 0}
		<div class="validation-errors">
			{#each validationErrors as error}
				<div class="error-item">
					<strong>{error.file}:</strong> {error.error.message}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.image-upload-container {
		margin: 8px 0;
	}

	.upload-zone {
		border: 2px dashed var(--color-border, #ccc);
		border-radius: 8px;
		padding: 16px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: var(--color-background-secondary, #f8f9fa);
	}

	.upload-zone:hover:not(.disabled) {
		border-color: var(--color-primary, #007bff);
		background: var(--color-background-hover, #e9ecef);
	}

	.upload-zone.drag-over {
		border-color: var(--color-primary, #007bff);
		background: var(--color-primary-light, #e3f2fd);
	}

	.upload-zone.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-content {
		pointer-events: none;
	}

	.upload-icon {
		font-size: 32px;
		font-weight: 300;
		color: var(--color-text-secondary, #666);
		margin-bottom: 8px;
	}

	.upload-text {
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text, #333);
		margin-bottom: 4px;
	}

	.upload-subtext {
		font-size: 12px;
		color: var(--color-text-secondary, #666);
	}

	.file-previews {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.file-preview {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--color-background, white);
		border: 1px solid var(--color-border, #ddd);
		border-radius: 8px;
		padding: 8px;
		width: 120px;
	}

	.preview-image {
		position: relative;
		width: 100px;
		height: 100px;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.preview-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-file-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 50%;
		background: var(--color-error, #dc3545);
		color: white;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.remove-file-btn:hover {
		background: var(--color-error-dark, #c82333);
	}

	.file-info {
		text-align: center;
		width: 100%;
	}

	.file-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text, #333);
		margin-bottom: 2px;
		word-break: break-all;
		line-height: 1.2;
		max-height: 2.4em;
		overflow: hidden;
	}

	.file-size {
		font-size: 10px;
		color: var(--color-text-secondary, #666);
	}

	.validation-errors {
		margin-top: 8px;
		padding: 8px;
		background: var(--color-error-background, #f8d7da);
		border: 1px solid var(--color-error-border, #f5c6cb);
		border-radius: 4px;
		color: var(--color-error-text, #721c24);
	}

	.error-item {
		font-size: 12px;
		margin-bottom: 4px;
	}

	.error-item:last-child {
		margin-bottom: 0;
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.file-preview {
			width: 100px;
		}

		.preview-image {
			width: 80px;
			height: 80px;
		}

		.upload-zone {
			padding: 12px;
		}

		.upload-icon {
			font-size: 20px;
		}

		.upload-text {
			font-size: 13px;
		}

		.upload-subtext {
			font-size: 11px;
		}
	}
</style>
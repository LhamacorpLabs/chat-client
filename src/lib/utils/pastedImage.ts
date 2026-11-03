// Browsers hand pasted clipboard images over as PNG, even when they were copied
// from a JPEG. For photos that is often 5-10x larger than the original file, so
// opaque pasted images are re-encoded as JPEG and the smaller file is kept.
// Images with any transparency stay PNG, since JPEG would turn it black.

export const PASTED_JPEG_QUALITY = 0.85;

export async function optimizePastedImage(file: File): Promise<File> {
	if (file.type !== 'image/png') return file;

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file;
	}

	try {
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0);

		if (hasTransparency(ctx, canvas.width, canvas.height)) return file;

		const blob = await new Promise<Blob | null>(resolve =>
			canvas.toBlob(resolve, 'image/jpeg', PASTED_JPEG_QUALITY)
		);
		if (!blob || blob.size >= file.size) return file;

		return new File([blob], toJpegName(file.name), {
			type: 'image/jpeg',
			lastModified: Date.now()
		});
	} catch {
		return file;
	} finally {
		bitmap.close();
	}
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
	const data = ctx.getImageData(0, 0, width, height).data;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] < 255) return true;
	}
	return false;
}

export function toJpegName(name: string): string {
	const base = (name || '').replace(/\.[^.]+$/, '');
	return `${base || 'pasted-image'}.jpg`;
}

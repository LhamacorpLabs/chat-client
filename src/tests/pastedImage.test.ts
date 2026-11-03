import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { optimizePastedImage, toJpegName, PASTED_JPEG_QUALITY } from '$lib/utils/pastedImage';

const WIDTH = 2;
const HEIGHT = 2;

function pngOfSize(bytes: number, name = 'image.png'): File {
	return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

function mockCanvas({
	alpha = 255,
	jpegBytes = 100
}: {
	alpha?: number;
	jpegBytes?: number | null;
}) {
	const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255);
	pixels[3] = alpha;
	const toBlob = vi.fn((cb: BlobCallback) =>
		cb(jpegBytes === null ? null : new Blob([new Uint8Array(jpegBytes)], { type: 'image/jpeg' }))
	);

	const ctx = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
	const realCreate = document.createElement.bind(document);
	vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
		if (tag !== 'canvas') return realCreate(tag);
		return { width: 0, height: 0, getContext: () => ctx, toBlob } as unknown as HTMLCanvasElement;
	});
	return { toBlob };
}

describe('optimizePastedImage', () => {
	const close = vi.fn();

	beforeEach(() => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => ({ width: WIDTH, height: HEIGHT, close }))
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		close.mockClear();
	});

	it('re-encodes an opaque PNG as a smaller JPEG', async () => {
		const { toBlob } = mockCanvas({ jpegBytes: 100 });
		const result = await optimizePastedImage(pngOfSize(1000));

		expect(result.type).toBe('image/jpeg');
		expect(result.name).toBe('image.jpg');
		expect(result.size).toBe(100);
		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', PASTED_JPEG_QUALITY);
		expect(close).toHaveBeenCalled();
	});

	it('keeps the PNG when it has transparency', async () => {
		const { toBlob } = mockCanvas({ alpha: 0 });
		const png = pngOfSize(1000);

		expect(await optimizePastedImage(png)).toBe(png);
		expect(toBlob).not.toHaveBeenCalled();
	});

	it('keeps the PNG when the JPEG is not smaller', async () => {
		mockCanvas({ jpegBytes: 2000 });
		const png = pngOfSize(1000);

		expect(await optimizePastedImage(png)).toBe(png);
	});

	it('keeps the PNG when encoding fails', async () => {
		mockCanvas({ jpegBytes: null });
		const png = pngOfSize(1000);

		expect(await optimizePastedImage(png)).toBe(png);
	});

	it('keeps the PNG when it cannot be decoded', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => {
				throw new Error('bad image');
			})
		);
		const png = pngOfSize(1000);

		expect(await optimizePastedImage(png)).toBe(png);
	});

	it('leaves non-PNG images untouched', async () => {
		const gif = new File([new Uint8Array(10)], 'anim.gif', { type: 'image/gif' });

		expect(await optimizePastedImage(gif)).toBe(gif);
		expect(createImageBitmap).not.toHaveBeenCalled();
	});
});

describe('toJpegName', () => {
	it('swaps the extension for .jpg', () => {
		expect(toJpegName('image.png')).toBe('image.jpg');
	});

	it('falls back to a default name', () => {
		expect(toJpegName('')).toBe('pasted-image.jpg');
	});
});

export interface EmoteEntry {
	code: string;
	src: string;
}

// Drop an image into src/lib/assets/emotes/ and it becomes an emote; the
// filename (lowercased, without extension) is the code, e.g. pepe.png -> :pepe:.
const files = import.meta.glob<string>('/src/lib/assets/emotes/*.{png,gif,webp,jpg,jpeg}', {
	query: '?url',
	import: 'default',
	eager: true
});

export const emotes: EmoteEntry[] = Object.entries(files)
	.map(([path, src]) => {
		const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
		return { code: `:${name.toLowerCase()}:`, src };
	})
	.sort((a, b) => a.code.localeCompare(b.code));

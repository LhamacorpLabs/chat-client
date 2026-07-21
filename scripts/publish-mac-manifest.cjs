const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = 'LhamacorpLabs/chat-client';
const PRODUCT_NAME = 'Chat';
const RELEASE_DIR = path.join(__dirname, '..', 'release');
const ARCHS = ['arm64', 'x64'];

// GitHub's secret UI/CLI can mangle a multi-line PEM in a few common ways
// (stripped newlines, literal "\n" text instead of real newlines, or just
// the base64 body pasted without the BEGIN/END header lines). Normalize
// whatever we're given back into a well-formed PKCS8 PEM before parsing.
function normalizePrivateKeyPem(raw) {
	const unescaped = raw.replace(/\\n/g, '\n');
	const base64 = unescaped.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
	const lines = base64.match(/.{1,64}/g) || [];
	return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

function main() {
	const version = process.env.APP_VERSION;
	const privateKeyPemRaw = process.env.MAC_UPDATE_SIGNING_KEY;

	if (!version) throw new Error('APP_VERSION env var is required');
	if (!privateKeyPemRaw) throw new Error('MAC_UPDATE_SIGNING_KEY env var is required');

	const privateKey = crypto.createPrivateKey(normalizePrivateKeyPem(privateKeyPemRaw));
	const manifest = { version };

	for (const arch of ARCHS) {
		const fileName = `${PRODUCT_NAME}_${version}_${arch}.zip`;
		const filePath = path.join(RELEASE_DIR, fileName);
		const buffer = fs.readFileSync(filePath);
		const sha512 = crypto.createHash('sha512').update(buffer).digest('hex');
		const message = `${version}:${arch}:${sha512}`;
		const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('base64');

		manifest[arch] = {
			url: `https://github.com/${REPO}/releases/download/v${version}/${fileName}`,
			sha512,
			signature
		};
	}

	fs.writeFileSync(path.join(RELEASE_DIR, 'latest-mac.json'), JSON.stringify(manifest, null, 2));
	console.log('Wrote release/latest-mac.json');
}

main();

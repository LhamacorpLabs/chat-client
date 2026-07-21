import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as signMessage } from 'node:crypto';
import { compareVersions } from '../../electron/mac-update/version-compare.cjs';
import { sha512Hex, buildSignedMessage, verifySignature } from '../../electron/mac-update/verify.cjs';
import { resolveBundlePaths } from '../../electron/mac-update/bundle-path.cjs';

describe('mac-update/version-compare', () => {
	it('orders versions numerically, not lexically', () => {
		expect(compareVersions('26.7.9', '26.7.42')).toBeLessThan(0);
		expect(compareVersions('26.7.42', '26.8.1')).toBeLessThan(0);
		expect(compareVersions('26.8.1', '27.1.1')).toBeLessThan(0);
	});

	it('treats equal versions as equal', () => {
		expect(compareVersions('26.7.42', '26.7.42')).toBe(0);
	});

	it('handles differing segment counts', () => {
		expect(compareVersions('26.7', '26.7.1')).toBeLessThan(0);
		expect(compareVersions('26.7.0', '26.7')).toBe(0);
	});
});

describe('mac-update/verify', () => {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

	function sign(message: string, key = privateKey) {
		return signMessage(null, Buffer.from(message), key).toString('base64');
	}

	it('computes a sha512 hex digest', () => {
		const digest = sha512Hex(Buffer.from('hello'));
		expect(digest).toMatch(/^[0-9a-f]{128}$/);
	});

	it('accepts a valid signature over the exact message', () => {
		const message = buildSignedMessage({ version: '26.7.42', arch: 'arm64', sha512: 'abc123' });
		const signatureBase64 = sign(message);

		expect(verifySignature({ publicKeyPem, message, signatureBase64 })).toBe(true);
	});

	it('rejects a tampered version/arch/hash', () => {
		const message = buildSignedMessage({ version: '26.7.42', arch: 'arm64', sha512: 'abc123' });
		const signatureBase64 = sign(message);

		const tamperedArch = buildSignedMessage({ version: '26.7.42', arch: 'x64', sha512: 'abc123' });
		expect(verifySignature({ publicKeyPem, message: tamperedArch, signatureBase64 })).toBe(false);

		const tamperedHash = buildSignedMessage({ version: '26.7.42', arch: 'arm64', sha512: 'def456' });
		expect(verifySignature({ publicKeyPem, message: tamperedHash, signatureBase64 })).toBe(false);
	});

	it('rejects a signature made with a different keypair', () => {
		const other = generateKeyPairSync('ed25519');
		const message = buildSignedMessage({ version: '26.7.42', arch: 'arm64', sha512: 'abc123' });
		const signatureBase64 = sign(message, other.privateKey);

		expect(verifySignature({ publicKeyPem, message, signatureBase64 })).toBe(false);
	});
});

describe('mac-update/bundle-path', () => {
	it('resolves the app bundle root from the running executable path', () => {
		expect(resolveBundlePaths('/Applications/Chat.app/Contents/MacOS/Chat')).toEqual({
			appPath: '/Applications/Chat.app',
			appsDir: '/Applications',
			appName: 'Chat.app'
		});
	});

	it('handles paths containing spaces', () => {
		expect(
			resolveBundlePaths('/Users/dev/My Apps/Chat.app/Contents/MacOS/Chat')
		).toEqual({
			appPath: '/Users/dev/My Apps/Chat.app',
			appsDir: '/Users/dev/My Apps',
			appName: 'Chat.app'
		});
	});
});

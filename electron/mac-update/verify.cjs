const crypto = require('node:crypto');

function sha512Hex(buffer) {
	return crypto.createHash('sha512').update(buffer).digest('hex');
}

function buildSignedMessage({ version, arch, sha512 }) {
	return `${version}:${arch}:${sha512}`;
}

function verifySignature({ publicKeyPem, message, signatureBase64 }) {
	try {
		return crypto.verify(
			null,
			Buffer.from(message),
			publicKeyPem,
			Buffer.from(signatureBase64, 'base64')
		);
	} catch {
		return false;
	}
}

module.exports = { sha512Hex, buildSignedMessage, verifySignature };

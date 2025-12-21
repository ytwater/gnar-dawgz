/**
 * Web Push helpers using webpush-webcrypto library
 * Compatible with Cloudflare Workers
 */

import {
	ApplicationServerKeys,
	generatePushHTTPRequest,
} from "webpush-webcrypto";

/**
 * Convert base64url string to Uint8Array
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Convert Uint8Array to base64url string
 */
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert VAPID keys from base64url format to ApplicationServerKeys
 * The library expects public key in raw format and private key in PKCS8 format
 */
async function convertVAPIDKeysToApplicationServerKeys(
	vapidPublicKey: string,
	vapidPrivateKey: string,
): Promise<ApplicationServerKeys> {
	// The VAPID keys are typically stored as base64url-encoded raw keys
	// We need to convert them to the format expected by ApplicationServerKeys

	// Decode the public key (should be 65 bytes uncompressed or 64 bytes)
	const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);

	// Ensure public key has 0x04 prefix for uncompressed format
	let publicKeyForImport: Uint8Array;
	if (publicKeyBytes.length === 64) {
		// Add 0x04 prefix for uncompressed format
		publicKeyForImport = new Uint8Array(65);
		publicKeyForImport[0] = 0x04;
		publicKeyForImport.set(publicKeyBytes, 1);
	} else if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
		publicKeyForImport = publicKeyBytes;
	} else {
		throw new Error(
			`Invalid VAPID public key length: ${publicKeyBytes.length}`,
		);
	}

	// Import public key as ECDSA (for VAPID signing)
	// Create a new Uint8Array to ensure proper ArrayBuffer type
	const publicKeyBuffer = new Uint8Array(publicKeyForImport).buffer;
	const publicKey = await crypto.subtle.importKey(
		"raw",
		publicKeyBuffer,
		{
			name: "ECDSA",
			namedCurve: "P-256",
		},
		true,
		[],
	);

	// For the private key, we need to convert from raw format to PKCS8
	// VAPID private keys are typically 32 bytes (raw)
	const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);

	if (privateKeyBytes.length !== 32) {
		throw new Error(
			`Invalid VAPID private key length: ${privateKeyBytes.length} (expected 32)`,
		);
	}

	// Convert raw private key to JWK format first, then to PKCS8
	// Extract x and y from public key
	const x = publicKeyForImport.slice(1, 33);
	const y = publicKeyForImport.slice(33, 65);

	const jwk = {
		kty: "EC",
		crv: "P-256",
		x: uint8ArrayToBase64Url(x),
		y: uint8ArrayToBase64Url(y),
		d: uint8ArrayToBase64Url(privateKeyBytes),
	};

	// Import as JWK to get a proper CryptoKey, then export as PKCS8
	const privateKeyJWK = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{
			name: "ECDSA",
			namedCurve: "P-256",
		},
		true,
		["sign"],
	);

	// Export as PKCS8 for ApplicationServerKeys
	const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", privateKeyJWK);

	// Now import it back as the format ApplicationServerKeys expects
	const privateKey = await crypto.subtle.importKey(
		"pkcs8",
		pkcs8PrivateKey,
		{
			name: "ECDSA",
			namedCurve: "P-256",
		},
		true,
		["sign"],
	);

	return new ApplicationServerKeys(publicKey, privateKey);
}

/**
 * Send push notification using webpush-webcrypto
 */
export async function sendWebPushNotification(
	endpoint: string,
	userPublicKey: string,
	userAuth: string,
	payload: string,
	vapidPublicKey: string,
	vapidPrivateKey: string,
	subject: string,
): Promise<void> {
	// Convert VAPID keys to ApplicationServerKeys format
	const applicationServerKeys = await convertVAPIDKeysToApplicationServerKeys(
		vapidPublicKey,
		vapidPrivateKey,
	);

	// Generate the encrypted push request
	const {
		headers,
		body,
		endpoint: requestEndpoint,
	} = await generatePushHTTPRequest({
		payload,
		applicationServerKeys,
		target: {
			endpoint,
			keys: {
				p256dh: userPublicKey,
				auth: userAuth,
			},
		},
		adminContact: subject,
		ttl: 86400, // 24 hours
	});

	console.log("Push request generated:", {
		endpoint: requestEndpoint,
		bodySize: body.byteLength,
		headers,
	});

	// Send to push service
	const response = await fetch(requestEndpoint, {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		const errorDetails = {
			status: response.status,
			statusText: response.statusText,
			body: text,
			endpoint: requestEndpoint,
		};
		console.error("Push service error:", errorDetails);
		throw new Error(
			`Push notification failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
		);
	}

	console.log("Push service responded successfully:", response.status);
}

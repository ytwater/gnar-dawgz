declare module "webpush-webcrypto" {
	export class ApplicationServerKeys {
		publicKey: CryptoKey;
		privateKey: CryptoKey;
		constructor(publicKey: CryptoKey, privateKey: CryptoKey);
		toJSON(): Promise<{ publicKey: string; privateKey: string }>;
		static fromJSON(keys: {
			publicKey: string;
			privateKey: string;
		}): Promise<ApplicationServerKeys>;
		static generate(): Promise<ApplicationServerKeys>;
	}

	export interface PushTarget {
		endpoint: string;
		keys: {
			p256dh: string;
			auth: string;
		};
	}

	export interface PushOptions {
		payload: string | Uint8Array;
		applicationServerKeys: ApplicationServerKeys;
		target: PushTarget;
		adminContact: string;
		ttl: number;
		topic?: string;
		urgency?: "very-low" | "low" | "normal" | "high";
	}

	export function generatePushHTTPRequest(
		options: PushOptions,
	): Promise<{
		headers: Record<string, string>;
		body: ArrayBuffer;
		endpoint: string;
	}>;

	export function setWebCrypto(crypto: Crypto): void;
}


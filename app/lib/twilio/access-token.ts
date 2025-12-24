import { SignJWT } from "jose";

type TwilioAccessTokenOptions = {
	ttl?: number; // seconds (default 3600)
	identity: string;
	region?: string;
	nbf?: number; // seconds since epoch
	serviceSid?: string; // for chat grant
};

/**
 * Edge-safe reimplementation of `twilio.jwt.AccessToken` (twilio@5.11.1).
 *
 * This avoids the `twilio` Node SDK (and its jsonwebtoken/jws deps) so it works in
 * Cloudflare Workers + Vite SSR.
 */
export async function createTwilioAccessTokenJwt(params: {
	accountSid: string;
	apiKeySid: string;
	apiKeySecret: string;
	options: TwilioAccessTokenOptions;
}) {
	const { accountSid, apiKeySid, apiKeySecret, options } = params;

	if (!accountSid) throw new Error("accountSid is required");
	if (!apiKeySid) throw new Error("apiKeySid is required");
	if (!apiKeySecret) throw new Error("apiKeySecret is required");
	if (!options?.identity) throw new Error("identity is required to be specified in options");

	const ttl = options.ttl ?? 3600;
	const now = Math.floor(Date.now() / 1000);

	const grants: Record<string, unknown> = {
		identity: String(options.identity),
	};

	// Twilio Conversations JS SDK uses the legacy "chat" grant shape.
	if (options.serviceSid) {
		grants.chat = { service_sid: options.serviceSid };
	}

	const payload: Record<string, unknown> = {
		jti: `${apiKeySid}-${now}`,
		grants,
	};

	if (typeof options.nbf === "number") {
		payload.nbf = options.nbf;
	}

	const header: Record<string, unknown> = {
		cty: "twilio-fpa;v=1",
		typ: "JWT",
	};

	if (options.region && typeof options.region === "string") {
		header.twr = options.region;
	}

	return await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256", ...header })
		.setIssuer(apiKeySid)
		.setSubject(accountSid)
		.setIssuedAt(now) // jsonwebtoken adds iat by default
		.setExpirationTime(now + ttl)
		.sign(new TextEncoder().encode(apiKeySecret));
}



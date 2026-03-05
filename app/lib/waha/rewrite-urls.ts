import { generateId } from "ai";
import { getAppUrl } from "../../config/constants";
import { getDb } from "../db";
import { verifications } from "../schema";

/**
 * Rewrite any gnardawgs.surf URLs in a message to include OTP login params.
 * Generates a single OTP code shared across all URLs in the message.
 */
export async function rewriteUrlsWithOtp(
	text: string,
	phoneNumber: string,
	env: CloudflareBindings,
): Promise<string> {
	const appUrl = getAppUrl(env);
	// Match URLs like https://www.gnardawgs.surf/... or the appUrl itself
	const urlPattern = new RegExp(
		`(https?://(?:www\\.)?gnardawgs\\.surf|${escapeRegex(appUrl)})(/[^\\s)]*)?`,
		"g",
	);

	const matches = [...text.matchAll(urlPattern)];
	if (matches.length === 0) return text;

	// Filter out URLs that already point to /login
	const rewritable = matches.filter((m) => {
		const path = m[2] || "/";
		return !path.startsWith("/login");
	});
	if (rewritable.length === 0) return text;

	// Generate one OTP for the whole message
	const code = Math.floor(100000 + Math.random() * 900000);
	const db = getDb(env.DB);
	await db.insert(verifications).values({
		id: generateId(),
		identifier: phoneNumber,
		value: `${code}:0`,
		expiresAt: new Date(Date.now() + 1000 * 60 * 5),
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Replace each URL with login link
	let result = text;
	for (const match of rewritable) {
		const fullUrl = match[0];
		const path = match[2] || "/";
		const loginUrl = `${appUrl}/login?phone=${encodeURIComponent(phoneNumber)}&code=${code}&redirectTo=${encodeURIComponent(path)}`;
		result = result.replace(fullUrl, loginUrl);
	}

	return result;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

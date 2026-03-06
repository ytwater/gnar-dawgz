import { WAHA_SESSION_NAME } from "~/app/config/constants";
import { lidsControllerFindPNByLid } from "../whatsapp/whatsapp-api";

/**
 * Resolve a WhatsApp sender ID to a normalized phone number.
 *
 * - `12345@c.us` -> `+12345`
 * - `12345@lid` -> resolves via WAHA API, then normalizes
 * - `12345@g.us` -> `12345` (group ID, no + prefix)
 */
export async function resolvePhoneNumber(
	waId: string,
	env: CloudflareBindings,
): Promise<string> {
	if (waId.endsWith("@g.us")) {
		// Group IDs are not phone numbers
		return waId.replace(/@g\.us$/, "");
	}

	if (waId.endsWith("@lid")) {
		const lid = waId.replace(/@lid$/, "");
		try {
			const result = await lidsControllerFindPNByLid(
				lid,
				WAHA_SESSION_NAME,
				{
					headers: { "X-Api-Key": env.WAHA_API_KEY ?? "" },
				},
			);
			const pn = result.data?.pn;
			if (pn) {
				// pn is like "16195985494@c.us" or just "16195985494"
				const digits = pn.replace(/@c\.us$/, "");
				return `+${digits}`;
			}
		} catch (err) {
			console.error(`Failed to resolve LID ${lid}:`, err);
		}
		// Fallback: can't resolve, return the LID digits (not ideal but avoids crash)
		return lid;
	}

	// Regular @c.us or @s.whatsapp.net
	const digits = waId.replace(/@c\.us|@s\.whatsapp\.net/g, "");
	return `+${digits}`;
}

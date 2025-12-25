export function getTwilioAuthHeaders(env: CloudflareBindings): HeadersInit {
	if (env.TWILIO_AUTH_TOKEN) {
		const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
		return {
			Authorization: `Basic ${auth}`,
		};
	}
	if (!env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
		throw new Error("TWILIO_API_KEY and TWILIO_API_SECRET are required");
	}
	const auth = btoa(`${env.TWILIO_API_KEY}:${env.TWILIO_API_SECRET}`);
	return {
		Authorization: `Basic ${auth}`,
	};
}

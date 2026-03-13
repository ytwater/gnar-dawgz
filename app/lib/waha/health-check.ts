import { WAHA_SESSION_NAME } from "~/app/config/constants";
import { SessionInfoStatus } from "../whatsapp/models/sessionInfoStatus";

const KV_KEY = "waha:health";

interface WahaHealthState {
	isDown: boolean;
	downSince: string;
	lastAlertAt: string;
	/** How many alert emails have been sent during this outage */
	alertCount: number;
}

interface WahaSessionResponse {
	name: string;
	status: string;
}

type HealthResult =
	| { healthy: true }
	| { healthy: false; status: string | null; error: string | null };

// Backoff: 2h, 4h, 8h, 16h, then cap at 24h
function backoffHours(alertCount: number): number {
	return Math.min(Math.pow(2, alertCount), 24);
}

async function checkWahaHealth(env: CloudflareBindings): Promise<HealthResult> {
	const url = `https://waha.gnardawgs.surf/api/sessions/${WAHA_SESSION_NAME}`;

	try {
		const res = await fetch(url, {
			headers: {
				"X-Api-Key": env.WAHA_API_KEY,
				Accept: "application/json",
			},
		});

		if (!res.ok) {
			return {
				healthy: false,
				status: null,
				error: `WAHA API returned HTTP ${res.status}`,
			};
		}

		const session = (await res.json()) as WahaSessionResponse;

		if (session.status === SessionInfoStatus.WORKING) {
			return { healthy: true };
		}

		return {
			healthy: false,
			status: session.status ?? "unknown",
			error: null,
		};
	} catch (err) {
		return {
			healthy: false,
			status: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

async function sendEmail(
	env: CloudflareBindings,
	subject: string,
	body: string,
): Promise<void> {
	const domain = env.MAILGUN_DOMAIN;
	const apiKey = env.MAILGUN_API_KEY;

	if (!domain || !apiKey) {
		console.error("MAILGUN_DOMAIN or MAILGUN_API_KEY is not configured");
		return;
	}

	const form = new FormData();
	form.append("from", `WAHA Monitor <mailgun@${domain}>`);
	form.append("to", "ytwater@gmail.com");
	form.append("subject", subject);
	form.append("text", body);

	const credentials = btoa(`api:${apiKey}`);

	const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
		method: "POST",
		headers: { Authorization: `Basic ${credentials}` },
		body: form,
	});

	if (!res.ok) {
		const text = await res.text();
		console.error(`Mailgun send failed (${res.status}): ${text}`);
	} else {
		console.log(`Email sent: ${subject}`);
	}
}

function formatTimestamp(iso: string): string {
	return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function uniqueTimestamp(): string {
	return formatTimestamp(new Date().toISOString());
}

/**
 * Runs the full WAHA health check cycle with KV-backed state and email backoff.
 * Call this once per hour from the scheduled handler.
 */
export async function runWahaHealthCheck(
	env: CloudflareBindings,
): Promise<void> {
	const now = new Date();
	const result = await checkWahaHealth(env);

	const stateJson = await env.KV.get(KV_KEY);
	const prevState: WahaHealthState | null = stateJson
		? (JSON.parse(stateJson) as WahaHealthState)
		: null;

	if (result.healthy) {
		if (prevState?.isDown) {
			// Was down, now recovered — send recovery email and clear state
			const downSince = formatTimestamp(prevState.downSince);
			const nowTs = uniqueTimestamp();
			const downMinutes = Math.round(
				(now.getTime() - new Date(prevState.downSince).getTime()) / 60_000,
			);
			const duration =
				downMinutes < 60
					? `${downMinutes}m`
					: `${Math.floor(downMinutes / 60)}h ${downMinutes % 60}m`;

			await sendEmail(
				env,
				`WAHA Recovered [${nowTs}]`,
				[
					`WAHA session is back WORKING as of ${nowTs}.`,
					"",
					`It was down since ${downSince} (outage duration: ~${duration}).`,
					"",
					`Dashboard: https://waha.gnardawgs.surf/dashboard`,
				].join("\n"),
			);

			await env.KV.delete(KV_KEY);
		} else {
			console.log("WAHA health check passed");
		}
		return;
	}

	// WAHA is down
	const reason = result.error
		? `Error: ${result.error}`
		: `Session status: ${result.status ?? "unknown"}`;

	if (!prevState?.isDown) {
		// First detection — alert immediately
		const nowTs = uniqueTimestamp();
		const state: WahaHealthState = {
			isDown: true,
			downSince: now.toISOString(),
			lastAlertAt: now.toISOString(),
			alertCount: 1,
		};

		await sendEmail(
			env,
			`WAHA Down [${nowTs}]`,
			[
				`WAHA health check failed at ${nowTs}.`,
				"",
				reason,
				"",
				`Dashboard: https://waha.gnardawgs.surf/dashboard`,
			].join("\n"),
		);

		await env.KV.put(KV_KEY, JSON.stringify(state));
		return;
	}

	// Already known to be down — check backoff before sending another alert
	const hoursSinceLastAlert =
		(now.getTime() - new Date(prevState.lastAlertAt).getTime()) / 3_600_000;
	const nextAlertIn = backoffHours(prevState.alertCount);

	if (hoursSinceLastAlert < nextAlertIn) {
		const remaining = (nextAlertIn - hoursSinceLastAlert).toFixed(1);
		console.log(`WAHA still down (${reason}). Next alert in ~${remaining}h`);
		return;
	}

	// Backoff elapsed — send another alert
	const nowTs = uniqueTimestamp();
	const downSince = formatTimestamp(prevState.downSince);

	await sendEmail(
		env,
		`WAHA Still Down [${nowTs}]`,
		[
			`WAHA is still not WORKING as of ${nowTs}.`,
			`It has been down since ${downSince}.`,
			"",
			reason,
			"",
			`Dashboard: https://waha.gnardawgs.surf/dashboard`,
		].join("\n"),
	);

	await env.KV.put(
		KV_KEY,
		JSON.stringify({
			...prevState,
			lastAlertAt: now.toISOString(),
			alertCount: prevState.alertCount + 1,
		}),
	);
}

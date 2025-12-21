import type { Route } from "./+types/api.push.vapid-key";

export async function loader({ context }: Route.LoaderArgs) {
	const env = context.cloudflare.env as CloudflareBindings;

	return Response.json({
		publicKey: env.VAPID_PUBLIC_KEY,
	});
}

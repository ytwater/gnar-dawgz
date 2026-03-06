import { createAuth } from "~/app/lib/auth";
import type { Route } from "./+types/api.profile-image.$";

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const env = context.cloudflare.env as CloudflareBindings;
	// biome-ignore lint/suspicious/noExplicitAny: Cloudflare request object has .cf
	const auth = createAuth(env, (request as any).cf);

	// Verify session
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user?.id) {
		return new Response("Unauthorized", { status: 401 });
	}

	// The splat param is the R2 key, e.g. "profiles/{userId}/{id}/stylized-dog.png"
	const key = params["*"];
	if (!key) {
		return new Response("Not Found", { status: 404 });
	}

	// Allow any authenticated user to view profile images
	if (!key.startsWith("profiles/")) {
		return new Response("Forbidden", { status: 403 });
	}

	// Get object from R2
	const object = await env.PROFILE_IMAGES_BUCKET.get(key);
	if (!object) {
		return new Response("Not Found", { status: 404 });
	}

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
	headers.set("Cache-Control", "private, max-age=3600");

	return new Response(object.body, { headers });
}

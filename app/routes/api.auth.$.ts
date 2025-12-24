import { createAuth } from "~/lib/auth";
import type { Route } from "./+types/api.auth.$";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const cf = context.request.cf as unknown;
	const auth = createAuth(context.cloudflare.env, cf);
	return auth.handler(request);
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	return auth.handler(request);
};

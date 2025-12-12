import { createRequestHandler } from "react-router";
import { routeAgentRequest } from "agents";
import { Chat } from "./chat-agent";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export { Chat };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Log for debugging
		console.log("Request:", url.pathname);
		
		// Try agent routing first
		try {
			const agentResponse = await routeAgentRequest(request, env);
			if (agentResponse) {
				console.log("Agent response returned");
				return agentResponse;
			}
		} catch (error) {
			console.error("Agent routing error:", error);
			return new Response(JSON.stringify({ error: String(error) }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Fall back to react-router
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<Env>;

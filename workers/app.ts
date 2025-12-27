import { routeAgentRequest } from "agents";
import { createRequestHandler } from "react-router";
import { REQUIRED_ENV_VARS } from "~/config/constants";
import { handleIncomingMessage } from "~/lib/chat/handleIncomingMessage";
import { Chat } from "./chat-agent";
import { WhatsAppAgent } from "./whatsapp-agent";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: CloudflareBindings;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export { Chat, WhatsAppAgent };

export default {
	async fetch(
		request: Request,
		env: CloudflareBindings,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const acceptHeader = request.headers.get("Accept") || "";
		const isHtmlRequest =
			acceptHeader.includes("text/html") ||
			(acceptHeader === "" && request.method === "GET");

		// Log for debugging
		console.log(
			"Request:",
			pathname,
			"Method:",
			request.method,
			"Accept:",
			acceptHeader,
			"isHtmlRequest:",
			isHtmlRequest,
		);

		// Validate ENV variables

		const missingVars = REQUIRED_ENV_VARS.filter(
			(varName) => !env[varName] || env[varName] === "",
		);

		if (missingVars.length > 0) {
			const errorMessage = `Missing required environment variables: ${missingVars.join(", ")}`;
			console.error(errorMessage);
			throw new Error(errorMessage);
		}

		// For non-HTML requests to /chat, try agent routing
		// The agents library might expect /agents/chat, so try both paths
		if (pathname === "/chat" && !isHtmlRequest) {
			try {
				// First try with the original path
				let agentResponse = await routeAgentRequest(request, env);
				if (agentResponse) {
					console.log("Agent response returned for /chat");
					return agentResponse;
				}

				// If that doesn't work, try rewriting to /agents/chat
				const rewrittenUrl = new URL(request.url);
				rewrittenUrl.pathname = "/agents/chat";
				const rewrittenRequest = new Request(rewrittenUrl.toString(), {
					method: request.method,
					headers: request.headers,
					body: request.body,
					duplex: request.body ? "half" : undefined,
				});
				agentResponse = await routeAgentRequest(rewrittenRequest, env);
				if (agentResponse) {
					console.log(
						"Agent response returned for /agents/chat (rewritten from /chat)",
					);
					return agentResponse;
				}

				// If still no match, return 404 for API requests
				console.log(
					"No agent response for /chat or /agents/chat, but it's an API request - returning 404",
				);
				return new Response(
					JSON.stringify({ error: "Agent route not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				console.error("Agent routing error:", error);
				return new Response(JSON.stringify({ error: String(error) }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// Try agent routing for other paths (like /agents/chat)
		// Only route agent requests for non-HTML requests or /agents/* paths
		if (!isHtmlRequest || pathname.startsWith("/agents/")) {
			try {
				const agentResponse = await routeAgentRequest(request, env);
				if (agentResponse) {
					console.log("Agent response returned");
					return agentResponse;
				}
			} catch (error) {
				console.error("Agent routing error:", error);
				// For HTML requests, continue to react-router even if agent routing fails
				if (!isHtmlRequest) {
					return new Response(JSON.stringify({ error: String(error) }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}
				// For HTML requests, log but continue to react-router handler
			}
		}

		// Fall back to react-router for HTML pages
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},

	async queue(
		batch: MessageBatch<any>,
		env: CloudflareBindings,
	): Promise<void> {
		for (const message of batch.messages) {
			try {
				await handleIncomingMessage(message.body, env);
				message.ack();
			} catch (error) {
				console.error("Error processing queue message:", error);
				message.retry();
			}
		}
	},
} satisfies ExportedHandler<Env>;

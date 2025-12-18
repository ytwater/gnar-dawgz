// Test file to verify agent works standalone
import { routeAgentRequest } from "agents";
import { Chat } from "./chat-agent";

export { Chat };

export default {
	async fetch(
		request: Request,
		env: CloudflareBindings,
		_ctx: ExecutionContext,
	): Promise<Response> {
		console.log("Test agent worker - URL:", request.url);

		// Route only agent requests
		const agentResponse = await routeAgentRequest(request, env);
		if (agentResponse) {
			return agentResponse;
		}

		return new Response("Test agent worker - no agent route matched", {
			status: 404,
		});
	},
} satisfies ExportedHandler<CloudflareBindings>;

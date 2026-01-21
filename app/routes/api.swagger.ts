import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "~/app/lib/orpc/router";
import type { Route } from "./+types/api.swagger";

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;

	const generator = new OpenAPIGenerator({
		schemaConverters: [new ZodToJsonSchemaConverter()],
	});

	const spec = await generator.generate(appRouter, {
		info: {
			title: "Gnar Dawgs API",
			version: "1.0.0",
			description: "API for Gnar Dawgs surf community",
		},
		servers: [{ url: `${baseUrl}/api/openapi` }],
		filter: ({ contract, path }) => {
			console.log("🚀 ~ api._index.ts:22 ~ loader ~ path:", path);
			// Example: exclude routes with "internal" tag
			// return !contract["~orpc"].route.tags?.includes("internal");

			// Example: only include specific routers
			// return path.startsWith("surfForecast") || path.startsWith("demerit");

			// Example: exclude specific paths
			return (
				(path[0] === "surfForecast" && path[1] === "getDashboardData") ||
				(path[0] === "surfForecast" && path[1] === "getForecasts")
			);
		},
	});

	return Response.json(spec, {
		headers: {
			"Content-Type": "application/json",
		},
	});
}

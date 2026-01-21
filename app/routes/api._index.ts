import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "~/app/lib/orpc/router";
import type { Route } from "./+types/api._index";

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
		servers: [{ url: `${baseUrl}/api/orpc` }],
	});

	return Response.json(spec, {
		headers: {
			"Content-Type": "application/json",
		},
	});
}

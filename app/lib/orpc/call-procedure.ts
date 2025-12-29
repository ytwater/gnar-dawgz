import { createRouterClient } from "@orpc/server";
import { surfForecastRouter } from "./routers/surf-forecast-router";
import type { ORPCContext } from "./server";

// Create a router client for server-side calls
// This ensures proper validation, middleware execution, and type safety
function createSurfForecastClient(context: ORPCContext) {
	return createRouterClient(surfForecastRouter, {
		context,
	});
}

// Convenience functions for surf forecast procedures
export async function getActiveSpots(context: ORPCContext) {
	const client = createSurfForecastClient(context);
	return client.getActiveSpots();
}

export async function getDashboardData(context: ORPCContext, spotId: string) {
	const client = createSurfForecastClient(context);
	return client.getDashboardData({ spotId });
}

export async function getSpots(context: ORPCContext) {
	const client = createSurfForecastClient(context);
	return client.getSpots();
}

export async function getTaxonomy(
	context: ORPCContext,
	parentId?: string,
	search?: string,
) {
	const client = createSurfForecastClient(context);
	return client.getTaxonomy({ parentId, search });
}

export async function getTaxonomyBreadcrumbs(
	context: ORPCContext,
	parentId: string,
) {
	const client = createSurfForecastClient(context);
	return client.getTaxonomyBreadcrumbs({ parentId });
}

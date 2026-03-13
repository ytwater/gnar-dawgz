import { createRouterClient } from "@orpc/server";
import { surfForecastRouter } from "./routers/surf-forecast-router";
import { surfReportRouter } from "./routers/surf-report-router";
import type { ORPCContext } from "./server";

function createSurfForecastClient(context: ORPCContext) {
	return createRouterClient(surfForecastRouter, {
		context,
	});
}

function createSurfReportClient(context: ORPCContext) {
	return createRouterClient(surfReportRouter, {
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

export async function getSurfReport(context: ORPCContext, spotId: string) {
	const client = createSurfReportClient(context);
	return client.getSurfReport({ spotId });
}

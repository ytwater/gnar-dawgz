/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, tool } from "ai";
import { add, set } from "date-fns";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { SURFLINE_TORREY_PINES_SPOT_ID } from "~/app/config/constants";
import { getDb } from "~/app/lib/db";
import { surfForecasts, surfSpots } from "~/app/lib/surf-forecast-schema";

export const createGetSurfSpotsTool = (env: CloudflareBindings) =>
	tool({
		description: "get the list of surf spots we have in the database.",
		inputSchema: z.object({}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
			}),
		),
		execute: async () => {
			const db = getDb(env.DB);

			// Find Torrey Pines spot
			const spots = await db
				.select()
				.from(surfSpots)
				.where(and(eq(surfSpots.isActive, true)))
				.orderBy(asc(surfSpots.name));

			return spots.map((spot) => ({
				id: spot.id,
				name: spot.name,
			}));
		},
	});

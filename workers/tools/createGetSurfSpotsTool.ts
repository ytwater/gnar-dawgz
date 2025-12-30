import { tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/app/lib/db";
import { surfSpots } from "~/app/lib/surf-forecast-schema";

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

import { tool } from "ai";
import { getDb } from "app/lib/db";
import { charter } from "app/lib/schema";
import { z } from "zod";

export const createGetCharterTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Get the current content of the Gnar Dawgs Global Charter. Use this when users ask about rules or violations.",
		inputSchema: z.object({}),
		execute: async () => {
			const db = getDb(env.DB);

			const results = await db.select().from(charter).limit(1);

			if (results.length === 0) {
				return "The Gnar Dawgs Global Charter hasn't been written yet! Time to establish some rules. 📑🐾";
			}

			return results[0].content;
		},
	});

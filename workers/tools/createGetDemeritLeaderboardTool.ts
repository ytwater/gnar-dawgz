import { desc, eq, sql } from "drizzle-orm";
import { tool } from "ai";
import { getDb } from "app/lib/db";
import { demerits, users } from "app/lib/schema";
import { z } from "zod";

export const createGetDemeritLeaderboardTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Get the list of users with active demerits, sorted by who has the most. Use this when users ask 'Who has the most demerits?' or want to see the demerit leaderboard.",
		inputSchema: z.object({}),
		execute: async () => {
			const db = getDb(env.DB);

			const leaderboard = await db
				.select({
					userId: demerits.toUserId,
					name: users.name,
					count: sql<number>`count(${demerits.id})`.mapWith(Number),
				})
				.from(demerits)
				.innerJoin(users, eq(demerits.toUserId, users.id))
				.where(eq(demerits.status, "active"))
				.groupBy(demerits.toUserId, users.name)
				.orderBy(desc(sql`count(${demerits.id})`))
				.limit(20);

			if (leaderboard.length === 0) {
				return "No one has any active demerits! Everyone's been on their best behavior. 🎉🐾";
			}

			const lines = leaderboard.map(
				(entry, index) => `${index + 1}. ${entry.name}: ${entry.count} demerit${entry.count !== 1 ? "s" : ""}`,
			);

			return `Demerit Leaderboard:\n\n${lines.join("\n")}`;
		},
	});

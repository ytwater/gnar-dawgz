import { desc, eq } from "drizzle-orm";
import { tool } from "ai";
import { getDb } from "app/lib/db";
import { demerits, users } from "app/lib/schema";
import { z } from "zod";

export const createGetDemeritLeaderboardTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Get the list of users with active demerits, sorted by who has the most. Includes each demerit and its reason. Use this when users ask 'Who has the most demerits?' or want to see the demerit leaderboard.",
		inputSchema: z.object({}),
		execute: async () => {
			const db = getDb(env.DB);

			// Get all active demerits with user info and reasons
			const allDemerits = await db
				.select({
					userId: demerits.toUserId,
					userName: users.name,
					reason: demerits.reason,
					createdAt: demerits.createdAt,
				})
				.from(demerits)
				.innerJoin(users, eq(demerits.toUserId, users.id))
				.where(eq(demerits.status, "active"))
				.orderBy(desc(demerits.createdAt));

			if (allDemerits.length === 0) {
				return "No one has any active demerits! Everyone's been on their best behavior. 🎉🐾";
			}

			// Group demerits by user
			const demeritsByUser = new Map<
				string,
				{ name: string; demerits: { reason: string; createdAt: Date }[] }
			>();

			for (const demerit of allDemerits) {
				if (!demerit.userName) continue;

				if (!demeritsByUser.has(demerit.userId)) {
					demeritsByUser.set(demerit.userId, {
						name: demerit.userName,
						demerits: [],
					});
				}

				demeritsByUser.get(demerit.userId)!.demerits.push({
					reason: demerit.reason,
					createdAt: demerit.createdAt,
				});
			}

			// Sort users by demerit count (descending)
			const sortedUsers = Array.from(demeritsByUser.entries())
				.map(([userId, data]) => ({
					userId,
					name: data.name,
					count: data.demerits.length,
					demerits: data.demerits,
				}))
				.sort((a, b) => b.count - a.count)
				.slice(0, 20);

			// Format output
			const lines = sortedUsers.map((entry, index) => {
				const demeritList = entry.demerits
					.map((d) => `  • ${d.reason}`)
					.join("\n");
				return `${index + 1}. ${entry.name} (${entry.count} demerit${entry.count !== 1 ? "s" : ""}):\n${demeritList}`;
			});

			return `Demerit Leaderboard:\n\n${lines.join("\n\n")}`;
		},
	});

import { tool } from "ai";
import { getDb } from "app/lib/db";
import { demerits, users } from "app/lib/schema";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";

export const createClearDemeritsTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Clear all active demerits for a member (e.g., when someone buys them a beer). You must search for the user by name.",
		inputSchema: z.object({
			recipientUserName: z
				.string()
				.describe(
					"The name of the user whose demerits should be cleared (e.g. 'Alex').",
				)
				.min(1),
		}),
		execute: async ({ recipientUserName }) => {
			const db = getDb(env.DB);

			// Search for the user by name (case-insensitive)
			const foundUsers = await db
				.select()
				.from(users)
				.where(like(users.name, `%${recipientUserName}%`))
				.limit(5);

			if (foundUsers.length === 0) {
				return `I couldn't find a member named "${recipientUserName}". No demerits were cleared.`;
			}

			if (foundUsers.length > 1) {
				const names = foundUsers.map((u) => u.name).join(", ");
				return `I found multiple members matching "${recipientUserName}": ${names}. Please be more specific about who bought the beer!`;
			}

			const recipientUser = foundUsers[0];

			// Mark all active demerits as cleared
			const result = await db
				.update(demerits)
				.set({
					status: "cleared",
					clearedAt: new Date(),
				})
				.where(
					and(
						eq(demerits.toUserId, recipientUser.id),
						eq(demerits.status, "active"),
					),
				);

			return `Success! All active demerits for ${recipientUser.name} have been cleared. Cheers to the beer! 🍻🐾`;
		},
	});

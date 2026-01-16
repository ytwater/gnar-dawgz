import { tool } from "ai";
import { getDb } from "app/lib/db";
import { demerits, users } from "app/lib/schema";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";

export const createClearDemeritsTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Clear a specific active demerit for a member (e.g., when someone buys them a beer). You must search for the user by name and specify which demerit to clear by its reason.",
		inputSchema: z.object({
			recipientUserName: z
				.string()
				.describe(
					"The name of the user whose demerit should be cleared (e.g. 'Alex').",
				)
				.min(1),
			demeritReason: z
				.string()
				.describe(
					"The reason/description of the specific demerit to clear (e.g. 'late to surf session'). This must match the exact reason text of the demerit.",
				)
				.min(1),
		}),
		execute: async ({ recipientUserName, demeritReason }) => {
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

			// Find the specific active demerit with matching reason
			const matchingDemerits = await db
				.select()
				.from(demerits)
				.where(
					and(
						eq(demerits.toUserId, recipientUser.id),
						eq(demerits.status, "active"),
						eq(demerits.reason, demeritReason),
					),
				)
				.limit(1);

			if (matchingDemerits.length === 0) {
				// List available demerits to help the user
				const activeDemerits = await db
					.select()
					.from(demerits)
					.where(
						and(
							eq(demerits.toUserId, recipientUser.id),
							eq(demerits.status, "active"),
						),
					);

				if (activeDemerits.length === 0) {
					return `${recipientUser.name} doesn't have any active demerits to clear.`;
				}

				const demeritList = activeDemerits
					.map((d) => `- "${d.reason}"`)
					.join("\n");
				return `I couldn't find an active demerit with reason "${demeritReason}" for ${recipientUser.name}. Here are their active demerits:\n${demeritList}\n\nPlease specify the exact reason text from the list above.`;
			}

			// Clear the specific demerit
			await db
				.update(demerits)
				.set({
					status: "cleared",
					clearedAt: new Date(),
				})
				.where(eq(demerits.id, matchingDemerits[0].id));

			return `Success! The demerit "${demeritReason}" for ${recipientUser.name} has been cleared. Cheers to the beer! 🍻🐾`;
		},
	});

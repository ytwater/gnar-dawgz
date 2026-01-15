import { generateId, tool } from "ai";
import { getDb } from "app/lib/db";
import { demerits, users } from "app/lib/schema";
import { like } from "drizzle-orm";
import { z } from "zod";

export const createAssignDemeritTool = (
	env: CloudflareBindings,
	fromUserId: string,
) =>
	tool({
		description:
			"Assign a demerit to a member for violating the charter. You must search for the user by name.",
		inputSchema: z.object({
			targetUserName: z
				.string()
				.describe(
					"The name of the user to assign the demerit to (e.g. 'Alex', 'Alex Smith').",
				)
				.min(1),
			reason: z
				.string()
				.describe("The reason for the demerit (e.g. 'late to surf session').")
				.min(1),
		}),
		execute: async ({ targetUserName, reason }) => {
			const db = getDb(env.DB);

			// Search for the user by name (case-insensitive)
			const foundUsers = await db
				.select()
				.from(users)
				.where(like(users.name, `%${targetUserName}%`))
				.limit(5);

			if (foundUsers.length === 0) {
				return `I couldn't find a member named "${targetUserName}". Please make sure you have the right name.`;
			}

			if (foundUsers.length > 1) {
				const names = foundUsers.map((u) => u.name).join(", ");
				return `I found multiple members matching "${targetUserName}": ${names}. Please be more specific.`;
			}

			const targetUser = foundUsers[0];

			// Prevent self-demerits? (Optional, but good for humor or guardrails)
			if (targetUser.id === fromUserId) {
				return "You can't give yourself a demerit, you cheeky dawg! 🐾";
			}

			// Create the demerit record
			await db.insert(demerits).values({
				id: generateId(),
				fromUserId,
				toUserId: targetUser.id,
				reason,
				status: "active",
				createdAt: new Date(),
			});

			return `Demerit assigned to ${targetUser.name} for: ${reason}. This violation has been recorded in the Gnar Dawgs charter tracker. 🐾`;
		},
	});

import { tool } from "ai";
import { getDb } from "app/lib/db";
import { users } from "app/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createUserNameTool = (env: CloudflareBindings, userId: string) =>
	tool({
		description:
			"Update the user's name in the database once they have provided it during onboarding.",
		inputSchema: z.object({
			name: z
				.string()
				.describe("The user's full name or preferred name.")
				.min(1),
		}),
		execute: async ({ name }: { name: string }) => {
			console.log(`Updating name for user ${userId} to ${name}`);
			// Convert spaces to .'s and remove special characters
			const stubName = name
				.toLowerCase()
				.replace(/\s+/g, ".")
				.replace(/[^a-z0-9]/g, "");
			let newEmail = `${stubName}@gnardawgs.surf`;
			const db = getDb(env.DB);

			// search for duplicate emails
			let i = 1;
			let duplicateEmails = [];
			do {
				duplicateEmails = await db
					.select()
					.from(users)
					.where(eq(users.email, newEmail));
				if (duplicateEmails.length > 0) {
					newEmail = `${stubName}.${i}@gnardawgs.surf`;
					i++;
				}
			} while (duplicateEmails.length > 0);

			await db
				.update(users)
				.set({ name, email: newEmail, updatedAt: new Date() })
				.where(eq(users.id, userId));

			return `${name}, your name has been updated! Welcome to Gnar Dawgs.  I'm the Gnar Dawgs assistant. I can help you with surf forecasts and other surf related tasks.`;
		},
	});

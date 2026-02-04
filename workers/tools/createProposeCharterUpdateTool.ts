import { generateId, tool } from "ai";
import { getDb } from "app/lib/db";
import { charter, charterProposals } from "app/lib/schema";

import { z } from "zod";

export const createProposeCharterUpdateTool = (
	env: CloudflareBindings,
	userId: string,
) => {
	return tool({
		description:
			"Propose an update to the Global Charter. This creates a proposal that must be approved by another member.",
		inputSchema: z.object({
			proposedContent: z.string().describe("The full new text of the charter."),
			reason: z.string().describe("The reason for this change."),
		}),
		execute: async ({ proposedContent, reason }) => {
			const db = getDb(env.DB);

			// Get current charter for snapshot
			const currentCharter = await db.select().from(charter).limit(1);
			const originalContent = currentCharter[0]?.content || "";

			if (proposedContent === originalContent) {
				return "The proposed content is identical to the current charter. No proposal created.";
			}

			await db.insert(charterProposals).values({
				id: generateId(),
				proposerId: userId,
				proposedContent,
				originalContent,
				reason,
				status: "pending",
				createdAt: new Date(),
			});

			return "Proposal to update the charter has been created. It requires approval from another member.";
		},
	});
};

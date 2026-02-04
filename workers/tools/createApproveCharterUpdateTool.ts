import { tool } from "ai";
import { generateId } from "ai";
import { getDb } from "app/lib/db";
import { charter, charterProposals } from "app/lib/schema";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const createApproveCharterUpdateTool = (
	env: CloudflareBindings,
	userId: string,
) => {
	return tool({
		description:
			"Approve a pending charter update proposal. You cannot approve your own proposal.",
		inputSchema: z.object({
			proposalId: z.string().describe("The ID of the proposal to approve."),
		}),
		execute: async ({ proposalId }) => {
			const db = getDb(env.DB);

			const proposal = await db
				.select()
				.from(charterProposals)
				.where(
					and(
						eq(charterProposals.id, proposalId),
						eq(charterProposals.status, "pending"),
					),
				)
				.limit(1);

			if (!proposal || proposal.length === 0) {
				return "Proposal not found or not pending.";
			}

			if (proposal[0].proposerId === userId) {
				return "You cannot approve your own proposal.";
			}

			const currentCharter = await db.select().from(charter).limit(1);

			// Update the charter
			if (currentCharter.length === 0) {
				await db.insert(charter).values({
					id: generateId(),
					content: proposal[0].proposedContent,
					updatedBy: userId,
				});
			} else {
				await db
					.update(charter)
					.set({
						content: proposal[0].proposedContent,
						updatedBy: userId,
					})
					.where(eq(charter.id, currentCharter[0].id));
			}

			// Update proposal status
			await db
				.update(charterProposals)
				.set({
					status: "approved",
					approverId: userId,
					resolvedAt: new Date(),
				})
				.where(eq(charterProposals.id, proposalId));

			return "Charter updated successfully.";
		},
	});
};

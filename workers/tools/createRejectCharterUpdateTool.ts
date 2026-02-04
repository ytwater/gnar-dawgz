import { tool } from "ai";
import { getDb } from "app/lib/db";
import { charterProposals } from "app/lib/schema";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const createRejectCharterUpdateTool = (
	env: CloudflareBindings,
	userId: string,
) => {
	return tool({
		description: "Reject a pending charter update proposal.",
		inputSchema: z.object({
			proposalId: z.string().describe("The ID of the proposal to reject."),
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

			// Self-rejection logic: Implicitly allowed or disallowed?
			// Usually you can withdraw your own proposal or reject others.
			// Let's allow anyone to reject for now (or maybe restric to non-proposer? User didn't specify reject permissions, assuming similar to approve but maybe looser?
			// Actually, for safety, let's implement the same restriction as approve (peer review) OR allow self-withdrawal.

			const isSelf = proposal[0].proposerId === userId;

			// If it's not self, it's a peer rejection. If it is self, it's a withdrawal. Both fine.

			await db
				.update(charterProposals)
				.set({
					status: "rejected",
					approverId: userId, // ID of person who rejected
					resolvedAt: new Date(),
				})
				.where(eq(charterProposals.id, proposalId));

			return isSelf ? "Proposal withdrawn." : "Proposal rejected.";
		},
	});
};

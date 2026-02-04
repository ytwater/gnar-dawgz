import { tool } from "ai";
import { getDb } from "app/lib/db";
import { charterProposals, users } from "app/lib/schema";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export const createGetPendingProposalsTool = (env: CloudflareBindings) => {
	return tool({
		description: "Get a list of all pending charter update proposals.",
		inputSchema: z.object({}),
		execute: async () => {
			const db = getDb(env.DB);

			const proposals = await db
				.select({
					id: charterProposals.id,
					reason: charterProposals.reason,
					proposerName: users.name,
					createdAt: charterProposals.createdAt,
					proposedContent: charterProposals.proposedContent,
				})
				.from(charterProposals)
				.leftJoin(users, eq(charterProposals.proposerId, users.id))
				.where(eq(charterProposals.status, "pending"))
				.orderBy(desc(charterProposals.createdAt));

			if (proposals.length === 0) {
				return "There are no pending proposals.";
			}

			return JSON.stringify(proposals, null, 2);
		},
	});
};

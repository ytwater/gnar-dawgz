import { generateId } from "ai";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { charter, charterProposals, demerits, users } from "../../schema";
import { adminProcedure, authedProcedure } from "../server";

export const demeritRouter = {
	getCharter: authedProcedure.handler(async ({ context }) => {
		const db = context.db;
		const results = await db.select().from(charter).limit(1);
		return (
			results[0] || {
				content:
					"# No Charter Yet\n\nThe Gnar Dawgs charter hasn't been written yet. Admin needs to set it up!",
			}
		);
	}),

	getLeaderboard: authedProcedure.handler(async ({ context }) => {
		const db = context.db;
		return await db
			.select({
				userId: demerits.toUserId,
				name: users.name,
				image: users.image,
				count: sql<number>`count(${demerits.id})`.mapWith(Number),
			})
			.from(demerits)
			.innerJoin(users, eq(demerits.toUserId, users.id))
			.where(eq(demerits.status, "active"))
			.groupBy(demerits.toUserId, users.name, users.image)
			.orderBy(desc(sql`count(${demerits.id})`))
			.limit(10);
	}),

	updateCharter: adminProcedure
		.input(z.object({ content: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			const db = context.db;
			const { content } = input;
			const userId = context.session.user.id;

			// Upsert charter (assume only one charter record with id 'global')
			const id = "global";
			await db
				.insert(charter)
				.values({
					id,
					content,
					updatedAt: new Date(),
					updatedBy: userId,
				})
				.onConflictDoUpdate({
					target: charter.id,
					set: {
						content,
						updatedAt: new Date(),
						updatedBy: userId,
					},
				});

			return { success: true };
		}),

	getUserDemerits: authedProcedure.handler(async ({ context }) => {
		const db = context.db;
		const userId = context.session.user.id;

		return await db
			.select({
				id: demerits.id,
				reason: demerits.reason,
				status: demerits.status,
				createdAt: demerits.createdAt,
				fromUserName: users.name,
			})
			.from(demerits)
			.leftJoin(users, eq(demerits.fromUserId, users.id))
			.where(eq(demerits.toUserId, userId))
			.orderBy(desc(demerits.createdAt));
	}),

	getDemeritsByUserId: authedProcedure
		.input(z.object({ userId: z.string() }))
		.handler(async ({ input, context }) => {
			const db = context.db;
			const { userId } = input;

			return await db
				.select({
					id: demerits.id,
					reason: demerits.reason,
					status: demerits.status,
					createdAt: demerits.createdAt,
					fromUserName: users.name,
				})
				.from(demerits)
				.leftJoin(users, eq(demerits.fromUserId, users.id))
				.where(
					and(eq(demerits.toUserId, userId), eq(demerits.status, "active")),
				)
				.orderBy(desc(demerits.createdAt));
		}),
	getPendingCharterProposals: authedProcedure.handler(async ({ context }) => {
		const db = context.db;
		return await db
			.select({
				id: charterProposals.id,
				proposerId: charterProposals.proposerId,
				proposerName: users.name,
				proposedContent: charterProposals.proposedContent,
				originalContent: charterProposals.originalContent,
				reason: charterProposals.reason,
				status: charterProposals.status,
				createdAt: charterProposals.createdAt,
			})
			.from(charterProposals)
			.leftJoin(users, eq(charterProposals.proposerId, users.id))
			.where(eq(charterProposals.status, "pending"))
			.orderBy(desc(charterProposals.createdAt));
	}),

	approveCharterProposal: authedProcedure
		.input(z.object({ proposalId: z.string() }))
		.handler(async ({ input, context }) => {
			const db = context.db;
			const { proposalId } = input;
			const userId = context.session.user.id;

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
				throw new Error("Proposal not found or not pending.");
			}

			if (proposal[0].proposerId === userId) {
				throw new Error("You cannot approve your own proposal.");
			}

			// Update the charter
			const currentCharter = await db.select().from(charter).limit(1);
			const id = "global";

			if (currentCharter.length === 0) {
				await db.insert(charter).values({
					id,
					content: proposal[0].proposedContent,
					updatedBy: userId,
					updatedAt: new Date(),
				});
			} else {
				await db
					.update(charter)
					.set({
						content: proposal[0].proposedContent,
						updatedBy: userId,
						updatedAt: new Date(),
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

			return { success: true };
		}),

	rejectCharterProposal: authedProcedure
		.input(z.object({ proposalId: z.string() }))
		.handler(async ({ input, context }) => {
			const db = context.db;
			const { proposalId } = input;
			const userId = context.session.user.id;

			await db
				.update(charterProposals)
				.set({
					status: "rejected",
					approverId: userId,
					resolvedAt: new Date(),
				})
				.where(eq(charterProposals.id, proposalId));

			return { success: true };
		}),

	proposeCharterUpdate: authedProcedure
		.input(
			z.object({
				proposedContent: z.string().min(1),
				reason: z.string().min(1),
			}),
		)
		.handler(async ({ input, context }) => {
			const db = context.db;
			const { proposedContent, reason } = input;
			const userId = context.session.user.id;

			const currentCharter = await db.select().from(charter).limit(1);
			const originalContent = currentCharter[0]?.content || "";

			if (proposedContent === originalContent) {
				throw new Error(
					"The proposed content is identical to the current charter.",
				);
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

			return { success: true };
		}),
};

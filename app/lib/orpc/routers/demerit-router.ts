import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { charter, demerits, users } from "../../schema";
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
					and(
						eq(demerits.toUserId, userId),
						eq(demerits.status, "active"),
					),
				)
				.orderBy(desc(demerits.createdAt));
		}),
};

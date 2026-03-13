import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { getDb } from "~/app/lib/db";
import { surfReports } from "~/app/lib/surf-report-schema";

const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

type Db = ReturnType<typeof getDb>;

export async function getCachedReport(
	db: Db,
	spotId: string,
): Promise<{ id: string; report: string; generatedAt: Date; expiresAt: Date } | null> {
	const now = new Date();

	const cached = await db
		.select()
		.from(surfReports)
		.where(
			and(
				eq(surfReports.surfSpotId, spotId),
				gte(surfReports.expiresAt, now),
			),
		)
		.orderBy(desc(surfReports.generatedAt))
		.limit(1);

	if (cached.length > 0) {
		return cached[0];
	}

	return null;
}

export async function storeCachedReport(
	db: Db,
	spotId: string,
	report: string,
): Promise<{ id: string; report: string; generatedAt: Date; expiresAt: Date }> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS);
	const id = `sr_${spotId}_${now.getTime()}`;

	await db.insert(surfReports).values({
		id,
		surfSpotId: spotId,
		report,
		generatedAt: now,
		expiresAt,
	});

	return {
		id,
		report,
		generatedAt: now,
		expiresAt,
	};
}

export async function cleanExpiredReports(db: Db): Promise<number> {
	const now = new Date();

	const result = await db
		.delete(surfReports)
		.where(lt(surfReports.expiresAt, now));

	return result.rowsAffected ?? 0;
}
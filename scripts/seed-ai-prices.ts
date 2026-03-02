import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { seedDefaultAiPrices } from "../app/lib/ai-cost-utils";

// Find the local D1 DB
function getLocalD1DB() {
	try {
		const basePath = path.resolve(
			"./.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
		);
		const dbFile = fs
			.readdirSync(basePath, { encoding: "utf-8", recursive: true })
			.find((f) => f.endsWith(".sqlite"));

		if (!dbFile) {
			throw new Error(`.sqlite file not found in ${basePath}`);
		}

		return path.resolve(basePath, dbFile);
	} catch (err) {
		console.log(`Error  ${err}`);
	}
}

async function runSeeder() {
	const dbPath = getLocalD1DB();
	if (!dbPath) return;

	console.log(`Using DB at: ${dbPath}`);
	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);

	console.log("Seeding AI prices...");
	// @ts-ignore - Drizzle types can be tricky between D1 and Better-sqlite3 but it works
	await seedDefaultAiPrices(db);
	console.log("Seeding complete.");
	sqlite.close();
}

runSeeder().catch(console.error);

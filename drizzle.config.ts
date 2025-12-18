import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";
import wranglerConfig from "./wrangler.json";
import "@dotenvx/dotenvx/config";

export function getLocalD1DB() {
	try {
		const basePath = path.resolve("./.wrangler");
		const dbFile = fs
			.readdirSync(basePath, { encoding: "utf-8", recursive: true })
			.find((f) => f.endsWith(".sqlite"));

		if (!dbFile) {
			throw new Error(`.sqlite file not found in ${basePath}`);
		}

		const url = path.resolve(basePath, dbFile);
		console.log("🚀 ~ drizzle.config.ts:20 ~ getLocalD1DB ~ url:", url);
		return url;
	} catch (err) {
		console.log(`Error  ${err}`);
	}
}

export default defineConfig({
	dialect: "sqlite",
	schema: "./app/lib/auth-schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: getLocalD1DB(),
	},

	// ...(process.env.NODE_ENV === "production"
	// 	? {
	// 			driver: "d1-http",
	// 			dbCredentials: {
	// 				accountId: process.env.CLOUDFLARE_D1_ACCOUNT_ID,
	// 				databaseId: wranglerConfig.d1_databases[0].database_id,
	// 				token: process.env.CLOUDFLARE_D1_API_TOKEN,
	// 			},
	// 		}
	// 	: {
	// 			dbCredentials: {
	// 				url: getLocalD1DB(),
	// 			},
	// 		}),
});

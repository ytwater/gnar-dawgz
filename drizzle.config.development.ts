import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";
import "@dotenvx/dotenvx/config";

function getLocalD1DB() {
	try {
		const basePath = path.resolve(".wrangler");
		const dbFile = fs
			.readdirSync(basePath, { encoding: "utf-8", recursive: true })
			.find((f) => f.endsWith(".sqlite"));
		console.log("🚀 ~ drizzle.config.ts:13 ~ getLocalD1DB ~ dbFile:", dbFile);

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
		url: getLocalD1DB() as string,
	},
});

import { defineConfig } from "drizzle-kit";
import wranglerConfig from "./wrangler.json";
import "@dotenvx/dotenvx/config";

export default defineConfig({
	dialect: "sqlite",
	schema: "./app/lib/schema.ts",
	out: "./drizzle",
	driver: "d1-http",
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
		databaseId: wranglerConfig.d1_databases[0].database_id,
		token: process.env.CLOUDFLARE_D1_API_TOKEN ?? "",
	},
});

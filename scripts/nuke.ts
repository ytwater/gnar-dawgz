#!/usr/bin/env tsx

import * as readline from "readline";
import Database from "better-sqlite3";
import { getLocalD1DB } from "../drizzle.config";
import wranglerConfig from "../wrangler.json";
import "@dotenvx/dotenvx/config";

function askQuestion(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function nukeDevelopmentDatabase() {
	console.log("💥 DATABASE NUKE SCRIPT - DEVELOPMENT");
	console.log(
		"⚠️  This will permanently delete ALL data from your local development database!",
	);
	console.log("📁 Target: .dev.db\n");

	// Safety confirmation
	const confirmation = await askQuestion(
		"Type 'nuke' to confirm you want to delete all development data: ",
	);

	if (confirmation !== "nuke") {
		console.log("❌ Operation cancelled. Database was not modified.");
		return false;
	}

	try {
		// Check if database file exists
		try {
			const dbPath = getLocalD1DB();
			const sqlite = new Database(dbPath);

			console.log("\n🗄️  Connected to local development database");

			// Get all table names
			const tables = sqlite
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
				)
				.all() as Array<{ name: string }>;

			if (tables.length === 0) {
				console.log("✅ Database is already empty - no tables found");
				sqlite.close();
				return true;
			}

			console.log(`🔍 Found ${tables.length} tables to clear:`);
			tables.forEach((table) => {
				console.log(`   - ${table.name}`);
			});

			// Disable foreign key constraints temporarily
			sqlite.exec("PRAGMA foreign_keys = OFF");

			// Clear tables in dependency order to avoid constraint issues
			const tableOrder = [
				// Events and related tables first
				"event_addons",
				"event_characters",
				"events",
				"checkout_sessions",

				// User-related tables
				"user_availability",
				"user_characters",

				// Core business tables
				"addons",
				"characters",
				"services",

				// Company and organization tables
				"company_settings",
				"members",
				"teams",
				"team_members",
				"invitations",
				"organizations",

				// Auth tables last
				"passkeys",
				"accounts",
				"verifications",
				"sessions",
				"users",
			];

			let totalRowsDeleted = 0;

			// Clear tables in specified order
			for (const tableName of tableOrder) {
				if (tables.some((t) => t.name === tableName)) {
					try {
						const result = sqlite.prepare(`DELETE FROM ${tableName}`).run();
						console.log(
							`🧹 Cleared table '${tableName}' (${result.changes} rows deleted)`,
						);
						totalRowsDeleted += result.changes;
					} catch (error) {
						console.error(`❌ Error clearing table '${tableName}':`, error);
					}
				}
			}

			// Clear any remaining tables not in our order
			const remainingTables = tables.filter(
				(t) => !tableOrder.includes(t.name),
			);
			for (const table of remainingTables) {
				try {
					const result = sqlite.prepare(`DELETE FROM ${table.name}`).run();
					console.log(
						`🧹 Cleared table '${table.name}' (${result.changes} rows deleted)`,
					);
					totalRowsDeleted += result.changes;
				} catch (error) {
					console.error(`❌ Error clearing table '${table.name}':`, error);
				}
			}

			// Re-enable foreign key constraints
			sqlite.exec("PRAGMA foreign_keys = ON");

			// Vacuum to reclaim space
			console.log("🗜️  Vacuuming database to reclaim space...");
			sqlite.exec("VACUUM");

			sqlite.close();

			console.log("\n💥 Development database nuked successfully!");
			console.log(
				`✅ ${totalRowsDeleted} rows deleted from ${tables.length} tables`,
			);
			console.log(
				"📊 Database schema preserved (tables still exist but empty)",
			);

			return true;
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "SQLITE_CANTOPEN"
			) {
				console.log("ℹ️  No development database file found");
				console.log("✅ Nothing to nuke - database doesn't exist yet");
				return true;
			}
			throw error;
		}
	} catch (error) {
		console.error("❌ Error nuking development database:", error);
		throw error;
	}
}

async function getD1Database(environment: "staging" | "production") {
	const envConfig = wranglerConfig.env[environment];
	if (!envConfig) {
		throw new Error(`Environment ${environment} not found in wrangler.json`);
	}

	const d1Config = envConfig.d1_databases[0];
	if (!d1Config) {
		throw new Error(`D1 database config not found for ${environment}`);
	}

	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

	if (!accountId) {
		throw new Error("CLOUDFLARE_ACCOUNT_ID environment variable is required");
	}
	if (!apiToken) {
		throw new Error("CLOUDFLARE_D1_API_TOKEN environment variable is required");
	}

	// Create D1 HTTP client with full interface
	const d1 = {
		async exec(query: string) {
			const response = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Config.database_id}/query`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						sql: query,
					}),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`D1 query failed: ${error}`);
			}

			const result = await response.json();
			return {
				results: result.result || [],
				changes: result.changes || 0,
				meta: result.meta || {},
			};
		},

		prepare(query: string) {
			return {
				bind(...params: unknown[]) {
					return {
						async run() {
							const response = await fetch(
								`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Config.database_id}/query`,
								{
									method: "POST",
									headers: {
										Authorization: `Bearer ${apiToken}`,
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										sql: query,
										params: params,
									}),
								},
							);

							if (!response.ok) {
								const error = await response.text();
								throw new Error(`D1 query failed: ${error}`);
							}

							const result = await response.json();
							return {
								changes: result.changes || 0,
								last_row_id: result.meta?.last_row_id || 0,
								meta: result.meta || {},
							};
						},
					};
				},
			};
		},
	};

	return d1;
}

async function nukeStagingDatabase() {
	console.log("💥 DATABASE NUKE SCRIPT - STAGING");
	console.log(
		"⚠️  This will permanently delete ALL data from your STAGING database!",
	);
	console.log("🌐 Target: Cloudflare D1 Staging Database\n");

	const confirmation = await askQuestion(
		"Type 'nuke' to confirm you want to delete all STAGING data: ",
	);

	if (confirmation !== "nuke") {
		console.log("❌ Operation cancelled. Staging database was not modified.");
		return false;
	}

	// Additional safety check for staging
	const doubleConfirmation = await askQuestion(
		"⚠️  Are you ABSOLUTELY sure? This affects STAGING environment. Type 'nuke' again: ",
	);

	if (doubleConfirmation !== "nuke") {
		console.log("❌ Operation cancelled. Staging database was not modified.");
		return false;
	}

	try {
		console.log("\n🌐 Connecting to staging D1 database...");
		const d1 = await getD1Database("staging");

		// Get all table names (excluding system tables)
		const tablesResult = await d1.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
    `);

		// Extract tables from the D1 response structure
		// D1 API returns results in result.result array
		const tables = (tablesResult.results || []) as Array<{
			name: string;
		}>;

		if (tables.length === 0) {
			console.log("✅ Database is already empty - no tables found");
			return true;
		}

		console.log(`🔍 Found ${tables.length} tables to clear:`);
		tables.forEach((table) => {
			console.log(`   - ${table.name}`);
		});

		// Clear tables in dependency order to avoid constraint issues
		const tableOrder = [
			// Events and related tables first
			"event_addons",
			"event_characters",
			"events",
			"checkout_sessions",

			// User-related tables
			"user_availability",
			"user_characters",

			// Core business tables
			"addons",
			"characters",
			"services",

			// Company and organization tables
			"company_settings",
			"members",
			"teams",
			"team_members",
			"invitations",
			"organizations",

			// Auth tables last
			"passkeys",
			"accounts",
			"verifications",
			"sessions",
			"users",
		];

		let totalRowsDeleted = 0;

		// Clear tables in specified order
		for (const tableName of tableOrder) {
			if (tables.some((t) => t.name === tableName)) {
				try {
					const result = await d1.exec(`DELETE FROM ${tableName}`);
					console.log(
						`🧹 Cleared table '${tableName}' (${result.changes} rows deleted)`,
					);
					totalRowsDeleted += result.changes;
				} catch (error) {
					console.error(`❌ Error clearing table '${tableName}':`, error);

					// Check if D1 is overloaded
					if (error && typeof error === "object" && "message" in error) {
						const errorMessage = String(error.message);
						if (
							errorMessage.includes("D1 DB is overloaded") ||
							errorMessage.includes("Requests queued for too long")
						) {
							console.log("\n🚨 D1 DATABASE IS OVERLOADED");
							console.log(
								"⏸️  Stopping nuke operation to prevent further issues",
							);
							console.log("💡 Please wait a few minutes and try again");
							console.log(
								`📊 Successfully cleared ${totalRowsDeleted} rows before stopping`,
							);
							return false;
						}
					}
				}
			}
		}

		// Clear any remaining tables not in our order
		const remainingTables = tables.filter((t) => !tableOrder.includes(t.name));
		for (const table of remainingTables) {
			try {
				const result = await d1.exec(`DELETE FROM ${table.name}`);
				console.log(
					`🧹 Cleared table '${table.name}' (${result.changes} rows deleted)`,
				);
				totalRowsDeleted += result.changes;
			} catch (error) {
				console.error(`❌ Error clearing table '${table.name}':`, error);
			}
		}

		console.log("\n💥 Staging database nuked successfully!");
		console.log(
			`✅ ${totalRowsDeleted} rows deleted from ${tables.length} tables`,
		);
		console.log("📊 Database schema preserved (tables still exist but empty)");

		return true;
	} catch (error) {
		console.error("❌ Error nuking staging database:", error);
		throw error;
	}
}

async function main() {
	console.log("🚀 Starting nuke script...");
	const args = process.argv.slice(2);
	const environment = args[0] || "dev";

	if (environment === "dev" || environment === "development") {
		const success = await nukeDevelopmentDatabase();
		if (success) {
			console.log(
				"🚀 You can now run 'pnpm run db:seed:dev' to repopulate with fresh data",
			);
		}
	} else if (environment === "staging") {
		const success = await nukeStagingDatabase();
		if (success) {
			console.log(
				"🚀 You can now run 'pnpm run db:seed:staging' to repopulate with fresh data",
			);
		}
	} else {
		console.log("❌ Invalid environment. Use 'dev' or 'staging'");
		console.log("Usage: tsx scripts/nuke.ts [dev|staging]");
		process.exit(1);
	}
}

// if (import.meta.main) {
main().catch((error) => {
	console.error("💥 Nuke operation failed:", error);
	process.exit(1);
});
// }

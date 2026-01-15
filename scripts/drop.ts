#!/usr/bin/env tsx

/**
 * Database Drop Script for Soccer League Management
 *
 * Usage:
 *   tsx scripts/drop.ts dev        # Drop all tables in local development database
 *   tsx scripts/drop.ts staging    # Drop all tables in staging D1 database
 *   tsx scripts/drop.ts production # Drop all tables in production D1 database
 *
 * Requirements for remote environments:
 *   - CLOUDFLARE_D1_API_TOKEN environment variable must be set
 *   - Valid Cloudflare account with D1 database access
 *
 * WARNING: This script completely removes tables and their schema!
 * This is more destructive than the nuke script which only clears data.
 */

import * as readline from "readline";
import Database from "better-sqlite3";
import { getLocalD1DB } from "../drizzle.config";
import wranglerConfig from "../wrangler.json";

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

async function getD1Database(environment: "staging" | "production") {
	const envConfig = wranglerConfig;
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
				bind(...params: any[]) {
					return {
						async all() {
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
								results: result.result || [],
								success: true,
								meta: result.meta || {},
							};
						},
						async first() {
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
							return result.result?.[0] || null;
						},
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

async function dropDevelopmentDatabase() {
	console.log("💥 DATABASE DROP SCRIPT - DEVELOPMENT");
	console.log(
		"⚠️  This will permanently DELETE ALL TABLES from your local development database!",
	);
	console.log("📁 Target: .dev.db");
	console.log("🚨 WARNING: This removes the entire schema, not just data!\n");

	// Safety confirmation
	const confirmation = await askQuestion(
		"Type 'DROP' to confirm you want to delete all tables: ",
	);

	if (confirmation !== "DROP") {
		console.log("❌ Operation cancelled. Database was not modified.");
		return false;
	}

	// Additional safety check
	const doubleConfirmation = await askQuestion(
		"⚠️  Are you ABSOLUTELY sure? This will destroy the entire schema. Type 'DROP' again: ",
	);

	if (doubleConfirmation !== "DROP") {
		console.log("❌ Operation cancelled. Database was not modified.");
		return false;
	}

	try {
		// Check if database file exists
		try {
			const sqlite = new Database(getLocalD1DB());

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

			console.log(`🔍 Found ${tables.length} tables to drop:`);
			tables.forEach((table) => {
				console.log(`   - ${table.name}`);
			});

			// Disable foreign key constraints temporarily
			sqlite.exec("PRAGMA foreign_keys = OFF");

			// Drop all tables
			const tableNames = tables.map((t) => t.name);
			let totalTablesDropped = 0;

			for (const tableName of tableNames) {
				try {
					sqlite.exec(`DROP TABLE IF EXISTS ${tableName}`);
					console.log(`🗑️  Dropped table '${tableName}'`);
					totalTablesDropped++;
				} catch (error) {
					console.error(`❌ Error dropping table '${tableName}':`, error);
				}
			}

			// Re-enable foreign key constraints
			sqlite.exec("PRAGMA foreign_keys = ON");

			// Vacuum to reclaim space
			console.log("🗜️  Vacuuming database to reclaim space...");
			sqlite.exec("VACUUM");

			sqlite.close();

			console.log("\n💥 Development database dropped successfully!");
			console.log(`✅ ${totalTablesDropped} tables dropped from database`);
			console.log("📊 Database schema completely removed");

			return true;
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "SQLITE_CANTOPEN"
			) {
				console.log("ℹ️  No development database file found (.dev.db)");
				console.log("✅ Nothing to drop - database doesn't exist yet");
				return true;
			}
			throw error;
		}
	} catch (error) {
		console.error("❌ Error dropping development database:", error);
		throw error;
	}
}

async function dropRemoteDatabase(environment: "staging" | "production") {
	console.log(`💥 DATABASE DROP SCRIPT - ${environment.toUpperCase()}`);
	console.log(
		`⚠️  This will permanently DELETE ALL TABLES from your ${environment.toUpperCase()} database!`,
	);
	console.log(`🌐 Target: Cloudflare D1 ${environment.toUpperCase()} Database`);
	console.log("🚨 WARNING: This removes the entire schema, not just data!\n");

	const confirmation = await askQuestion(
		`Type 'DROP' to confirm you want to delete all tables in ${environment.toUpperCase()}: `,
	);

	if (confirmation !== "DROP") {
		console.log(
			`❌ Operation cancelled. ${environment.toUpperCase()} database was not modified.`,
		);
		return false;
	}

	// Additional safety check for remote environments
	const doubleConfirmation = await askQuestion(
		`⚠️  Are you ABSOLUTELY sure? This will destroy the entire schema in ${environment.toUpperCase()}. Type 'DROP' again: `,
	);

	if (doubleConfirmation !== "DROP") {
		console.log(
			`❌ Operation cancelled. ${environment.toUpperCase()} database was not modified.`,
		);
		return false;
	}

	try {
		console.log(`\n🌐 Connecting to ${environment} D1 database...`);
		const d1 = await getD1Database(environment);

		// Get all table names (excluding system tables)
		const tablesResult = await d1.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
    `);

		// Extract tables from the nested D1 response structure
		const tables = (tablesResult.results[0]?.results || []) as Array<{
			name: string;
		}>;

		if (tables.length === 0) {
			console.log("✅ Database is already empty - no tables found");
			return true;
		}

		console.log(`🔍 Found ${tables.length} tables to drop:`);
		tables.forEach((table) => {
			console.log(`   - ${table.name}`);
		});

		// Define table drop order to respect foreign key constraints
		// Tables with no dependencies first, then tables that depend on them
		const dropOrder = [
			// Tables with no foreign key dependencies (or only to system tables)
			"user_characters",
			"event_addons",
			"event_characters",
			"event_assignments",
			"event_payments",
			"event_contracts",
			"gmail_messages",
			"gmail_threads",
			"stripe_transactions",
			"checkout_sessions",
			"events",
			"customers",
			"addons",
			"characters",
			"services",
			"invitations",
			"members",
			"accounts",
			"users",
			"organizations",
		];

		// Filter to only include tables that actually exist
		const existingTables = tables.map((t) => t.name);
		const orderedTables = dropOrder.filter((tableName) =>
			existingTables.includes(tableName),
		);

		// Add any tables not in our predefined order (shouldn't happen, but safety net)
		const remainingTables = existingTables.filter(
			(tableName) => !dropOrder.includes(tableName),
		);
		const finalDropOrder = [...orderedTables, ...remainingTables];

		console.log("📋 Dropping tables in dependency order:");
		finalDropOrder.forEach((tableName, index) => {
			console.log(`   ${index + 1}. ${tableName}`);
		});

		// Drop all tables in the correct order
		let totalTablesDropped = 0;

		for (const tableName of finalDropOrder) {
			try {
				await d1.exec(`DROP TABLE IF EXISTS ${tableName}`);
				console.log(`🗑️  Dropped table '${tableName}'`);
				totalTablesDropped++;
			} catch (error) {
				console.error(`❌ Error dropping table '${tableName}':`, error);

				// Check if D1 is overloaded
				if (error && typeof error === "object" && "message" in error) {
					const errorMessage = String(error.message);
					if (
						errorMessage.includes("D1 DB is overloaded") ||
						errorMessage.includes("Requests queued for too long")
					) {
						console.log("\n🚨 D1 DATABASE IS OVERLOADED");
						console.log("⏸️  Stopping drop operation to prevent further issues");
						console.log("💡 Please wait a few minutes and try again");
						console.log(
							`📊 Successfully dropped ${totalTablesDropped} tables before stopping`,
						);
						return false;
					}
				}
			}
		}

		console.log(
			`\n💥 ${environment.toUpperCase()} database dropped successfully!`,
		);
		console.log(`✅ ${totalTablesDropped} tables dropped from database`);
		console.log("📊 Database schema completely removed");

		return true;
	} catch (error) {
		console.error(`❌ Error dropping ${environment} database:`, error);
		throw error;
	}
}

async function main() {
	console.log("💥 DATABASE DROP SCRIPT - REMOTE");
	console.log(
		"⚠️  This will permanently DELETE ALL TABLES from your remote database!",
	);
	console.log("🌐 Target: Cloudflare D1 Remote Database");
	console.log("🚨 WARNING: This removes the entire schema, not just data!\n");

	const args = process.argv.slice(2);
	const environment = args[0];

	if (!environment) {
		console.log("❌ Environment argument is required");
		console.log("Usage: tsx scripts/drop.ts [dev|staging|production]");
		process.exit(1);
	}

	if (environment === "dev" || environment === "development") {
		const success = await dropDevelopmentDatabase();
		if (success) {
			console.log(
				"🚀 You can now run 'pnpm run db:migrate:dev' to recreate the schema",
			);
		}
	} else if (environment === "staging") {
		const success = await dropRemoteDatabase("staging");
		if (success) {
			console.log(
				"🚀 You can now run 'pnpm run db:migrate:stage' to recreate the schema",
			);
		}
	} else if (environment === "production") {
		const success = await dropRemoteDatabase("production");
		if (success) {
			console.log(
				"🚀 You can now run 'pnpm run db:migrate:prod' to recreate the schema",
			);
		}
	} else {
		console.log(
			"❌ Invalid environment. Use 'dev', 'staging', or 'production'",
		);
		console.log("Usage: tsx scripts/drop.ts [dev|staging|production]");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("💥 Drop operation failed:", error);
	process.exit(1);
});

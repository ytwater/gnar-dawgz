import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";

// Plugin to stub @twilio/conversations and events for SSR
const twilioStubPlugin = (): Plugin => ({
	name: "twilio-stub-ssr",
	enforce: "pre", // Run before other plugins
	resolveId(id, _importer, options) {
		if (options?.ssr) {
			if (
				id === "@twilio/conversations" ||
				id.startsWith("@twilio/conversations/")
			) {
				return `${id}?ssr-stub`;
			}
			// Also stub events package for SSR - catch all variations
			if (id === "events" || id === "node:events" || id.includes("/events/")) {
				return `events?ssr-stub`;
			}
		}
		return null;
	},
	load(id) {
		// Handle stubbed modules
		if (id === "@twilio/conversations?ssr-stub") {
			// Return the stub module content
			return `export const Client = class {
	static async create() {
		throw new Error("@twilio/conversations is client-only");
	}
};
export type Conversation = any;
export type Message = any;`;
		}
		if (id === "events?ssr-stub") {
			// Stub events module for SSR
			return `export class EventEmitter {
	on() { return this; }
	once() { return this; }
	off() { return this; }
	emit() { return false; }
	addListener() { return this; }
	removeListener() { return this; }
	removeAllListeners() { return this; }
	setMaxListeners() { return this; }
	getMaxListeners() { return 10; }
	listeners() { return []; }
	rawListeners() { return []; }
	listenerCount() { return 0; }
	prependListener() { return this; }
	prependOnceListener() { return this; }
	eventNames() { return []; }
}
export default EventEmitter;`;
		}
		// Also intercept the actual events file if it somehow gets through
		// Check for various path patterns where events might be loaded
		if (
			id.includes("/events/events.js") ||
			id.includes("/events@") ||
			id.endsWith("/events.js") ||
			(id.includes("events") && id.includes("node_modules"))
		) {
			// Return stub instead of the actual file
			return `export class EventEmitter {
	on() { return this; }
	once() { return this; }
	off() { return this; }
	emit() { return false; }
	addListener() { return this; }
	removeListener() { return this; }
	removeAllListeners() { return this; }
	setMaxListeners() { return this; }
	getMaxListeners() { return 10; }
	listeners() { return []; }
	rawListeners() { return []; }
	listenerCount() { return 0; }
	prependListener() { return this; }
	prependOnceListener() { return this; }
	eventNames() { return []; }
}
export default EventEmitter;`;
		}
		return null;
	},
});

export default defineConfig({
	plugins: [
		cloudflare({
			viteEnvironment: { name: "ssr" },
			configPath: "./wrangler.json",
			persistState: true,
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
		twilioStubPlugin(),
		nodePolyfills({
			// Twilio SDK specifically needs these (but not events for SSR)
			include: ["util", "buffer"],
			globals: {
				Buffer: true,
				global: true,
				process: true,
			},
		}),
	],
	ssr: {
		// Exclude @twilio/conversations and its Node.js dependencies from server bundle
		// since it's only used client-side and doesn't work in Cloudflare Workers
		external: ["@twilio/conversations", "events", "util"],
		noExternal: [],
	},
	build: {
		rollupOptions: {},
		// commonjsOptions: {
		// 	// This is the key: it allows the bundler to handle
		// 	// dependencies that use module.exports
		// 	transformMixedEsModules: true,
		// },
	},
	// optimizeDeps: {
	// 	// Force Vite to pre-bundle these so they are
	// 	// converted to ESM before the browser sees them
	// 	include: ["@twilio/conversations", "events", "util"],
	// },
});

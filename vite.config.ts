import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";

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
		// nodePolyfills({
		// 	// Twilio SDK specifically needs these (but not events for SSR)
		// 	include: ["util", "buffer"],
		// 	globals: {
		// 		Buffer: true,
		// 		global: true,
		// 		process: true,
		// 	},
		// }),
	],
	server: {
		allowedHosts: ["demo1.psg-labs.net"],
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

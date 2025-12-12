import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		cloudflare({
			viteEnvironment: { name: "ssr" },
			configPath: "./wrangler.jsonc",
			persistState: true,
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
	server: {
		https: false,
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom"],
					router: ["react-router"],
				},
			},
		},
	},
});

import { resolve } from "node:path";
import { biomePlugin } from "@pbr1111/vite-plugin-biome";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
	plugins: [biomePlugin(), dts()],
	base: "/",
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "vite-plugin-logger",
			fileName: "index",
		},
	},
});

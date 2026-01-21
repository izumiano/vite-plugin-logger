import type { Plugin } from "vite";
import { pluginName, transformSrc } from "./transform";

export default function logPlugin(props?: {
	mode?: string;
	includeFileExtensions?: string[];
	traceEnabled?: boolean;
	doServerLog?: boolean;
	logUrl?: string;
}): Plugin {
	props ??= {};
	let { mode, includeFileExtensions, traceEnabled, doServerLog, logUrl } =
		props;

	doServerLog = !!doServerLog && !!logUrl;

	if (!mode) {
		console.log(
			`[${pluginName}]: \x1b[33m'\x1b[35mmode\x1b[33m' not provideded, assuming '\x1b[36mproduction\x1b[33m'\x1b[0m`,
		);
		mode = "production";
	}

	includeFileExtensions ??= ["js", "jsx", "ts", "tsx"];
	const includeRegex = includeFileExtensions.map(
		(extension) => new RegExp(`\\.${extension}(\\?.+)?$`),
	);

	if (traceEnabled) {
		console.log(`[${pluginName}]: \x1b[36mTRACE ENABLED\x1b[0m`);
	}

	if (doServerLog) {
		console.log(`[${pluginName}]: \x1b[36mSERVER LOGGING ENABLED\x1b[0m`);
	}

	return {
		name: pluginName,
		enforce: "pre",
		transform(src, id) {
			if (
				(id.includes("node_modules") &&
					!id.includes("@izumiano/vite-logger")) ||
				!includeRegex.some((extension) => extension.test(id))
			) {
				return;
			}

			return transformSrc(src, id, {
				mode,
				traceEnabled: traceEnabled ?? false,
				doServerLog,
				logUrl,
			});
		},
	};
}

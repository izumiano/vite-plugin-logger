import generate from "@babel/generator";
import babelParser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import t, { type CallExpression } from "@babel/types";
import type { Plugin } from "vite";

const pluginName = "LogPlugin";

function handleIdentifer(path: NodePath<CallExpression>) {
	const classMethodPath = path.findParent(
		(p) => p.isClassMethod() || p.isClassProperty(),
	) as NodePath<t.ClassMethod> | NodePath<t.ClassProperty> | null;

	if (!classMethodPath) {
		return;
	}

	if (classMethodPath.node.key.type !== "Identifier") {
		return;
	}

	const methodName = classMethodPath.node.key.name;

	// To get the parent class name, find the ClassDeclaration/ClassExpression ancestor
	const classPath = classMethodPath.findParent(
		(p) => p.isClassDeclaration() || p.isClassExpression(),
	) as NodePath<t.ClassDeclaration> | NodePath<t.ClassExpression> | null;
	if (!classPath?.node.id) {
		return;
	}
	const className = classPath.node.id.name;

	// const properties = [
	// 	t.objectProperty(
	// 		t.identifier("caller"),
	// 		t.objectExpression([
	// 			t.objectProperty(t.identifier("class"), t.stringLiteral(className)),
	// 			t.objectProperty(t.identifier("method"), t.stringLiteral(methodName)),
	// 		]),
	// 	),
	// ];
	// const newArgument = t.objectExpression(properties);

	const arg = t.stringLiteral(`%c[${className}] %c[${methodName}]`);

	path.node.arguments.splice(0, 0, arg);
}

function handleDevLog(
	path: NodePath<CallExpression>,
	id: string,
	mode: string,
) {
	if (
		!mode.includes("production") ||
		!path.get("callee").isIdentifier({ name: "log" })
	) {
		return;
	}

	throw Object.assign(
		new Error(
			"Cannot use '\x1b[33mlog\x1b[37m()\x1b[31m' in a '\x1b[36mproduction\x1b[31m' build",
		),
		{
			id,
			plugin: pluginName,
			loc: {
				file: id,
				line: path.node.loc?.start.line,
				column: path.node.loc?.start.column,
			},
		},
	);
}

function handleLog(path: NodePath<CallExpression>) {
	const callee = path.get("callee");
	if (
		!callee.isIdentifier({ name: "logVerbose" }) &&
		!callee.isIdentifier({ name: "logError" }) &&
		!callee.isIdentifier({ name: "logWarn" })
	) {
		return;
	}

	handleIdentifer(path);
}

function handleTrace(path: NodePath<CallExpression>, traceEnabled: boolean) {
	const callee = path.get("callee");
	if (
		!callee.isIdentifier({ name: "trace" }) &&
		!callee.isIdentifier({ name: "traceWarn" }) &&
		!callee.isIdentifier({ name: "traceWithStacktrace" })
	) {
		return;
	}

	if (!traceEnabled) {
		path.remove();
		return;
	}

	handleIdentifer(path);
}

function transformSrc(
	src: string,
	id: string,
	{
		mode,
		traceEnabled,
		doServerLog: _doServerLog,
		logUrl: _logUrl,
	}: {
		mode: string;
		traceEnabled: boolean;
		doServerLog: boolean;
		logUrl?: string;
	},
): string {
	const ast = babelParser.parse(src, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	});
	traverse(ast, {
		CallExpression(path) {
			handleDevLog(path, id, mode);
			handleLog(path);

			handleTrace(path, traceEnabled);
		},
	});

	return generate(ast, {}, src).code;
}

export default function logPlugin(props?: {
	mode?: string;
	includeFileExtension?: string[];
	traceEnabled?: boolean;
	doServerLog?: boolean;
	logUrl?: string;
}): Plugin {
	props ??= {};
	let { mode, includeFileExtension, traceEnabled, doServerLog, logUrl } = props;

	if (!mode) {
		console.log(
			`[${pluginName}]: \x1b[33m'\x1b[35mmode\x1b[33m' not provideded, assuming '\x1b[36mproduction\x1b[33m'\x1b[0m`,
		);
		mode = "production";
	}

	includeFileExtension ??= ["js", "jsx", "ts", "tsx"];
	const includeRegex = includeFileExtension.map(
		(extension) => new RegExp(`\\.${extension}(\\?.+)?$`),
	);

	if (traceEnabled) {
		console.log(`[${pluginName}]: \x1b[36mTRACE ENABLED\x1b[0m`);
	}

	return {
		name: pluginName,
		enforce: "pre",
		transform(src, id) {
			if (
				id.includes("node_modules") ||
				!includeRegex.some((extension) => extension.test(id))
			) {
				return;
			}

			return {
				code: transformSrc(src, id, {
					mode,
					traceEnabled: traceEnabled ?? false,
					doServerLog: doServerLog ?? false,
					logUrl,
				}),
				map: null,
			};
		},
	};
}

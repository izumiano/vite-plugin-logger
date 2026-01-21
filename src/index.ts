import generate from "@babel/generator";
import babelParser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import t, { type CallExpression, type Identifier } from "@babel/types";
import type { Plugin } from "vite";

const pluginName = "LogPlugin";

function getModuleFromIdentifier(
	path: NodePath<CallExpression>,
	identifier: NodePath<Identifier>,
) {
	const binding = path.scope.getBinding(identifier.node.name);
	if (!binding || binding.kind !== "module") {
		return;
	}

	const importDeclarationPath = binding.path.parentPath;
	if (!importDeclarationPath?.isImportDeclaration()) {
		return;
	}

	return importDeclarationPath;
}

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

	const classPath = classMethodPath.findParent(
		(p) => p.isClassDeclaration() || p.isClassExpression(),
	) as NodePath<t.ClassDeclaration> | NodePath<t.ClassExpression> | null;
	if (!classPath?.node.id) {
		return;
	}
	const className = classPath.node.id.name;

	const arg = t.stringLiteral(`%c[${className}] %c[${methodName}]`);

	path.node.arguments.splice(0, 0, arg);
}

function handleDevLog(
	path: NodePath<CallExpression>,
	callee: NodePath<Identifier>,
	id: string,
	mode: string,
) {
	if (!mode.includes("production") || callee.node.name !== "log") {
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

function handleLog(
	path: NodePath<CallExpression>,
	callee: NodePath<Identifier>,
) {
	const name = callee.node.name;
	if (name !== "logVerbose" && name !== "logError" && name !== "logWarn") {
		return;
	}

	handleIdentifer(path);
}

function handleTrace(
	path: NodePath<CallExpression>,
	callee: NodePath<Identifier>,
	traceEnabled: boolean,
) {
	const name = callee.node.name;
	if (
		name !== "trace" &&
		name !== "traceWarn" &&
		name !== "traceWithStacktrace"
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
			const callee = path.get("callee");
			if (!callee.isIdentifier()) {
				return;
			}

			const module = getModuleFromIdentifier(path, callee);
			if (
				!module ||
				!module.node.source.value.includes("@izumiano/vite-logger")
			) {
				return;
			}

			handleDevLog(path, callee, id, mode);
			handleLog(path, callee);

			handleTrace(path, callee, traceEnabled);
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

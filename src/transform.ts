import generate from "@babel/generator";
import babelParser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import t, { type CallExpression, type Identifier } from "@babel/types";

export const pluginName = "LogPlugin";

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

export function transformSrc(
	src: string,
	id: string,
	{
		mode,
		traceEnabled,
		doServerLog,
		logUrl,
	}: {
		mode: string;
		traceEnabled: boolean;
		doServerLog: boolean;
		logUrl?: string;
	},
) {
	const ast = babelParser.parse(src, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	});
	traverse(ast, {
		Program(path) {
			if (!id.includes("@izumiano/vite-logger")) {
				return;
			}

			if (traceEnabled) {
				const newNode = t.expressionStatement(
					t.callExpression(
						t.memberExpression(t.identifier("console"), t.identifier("info")),
						[t.stringLiteral("TRACE ENABLED")],
					),
				);

				path.unshiftContainer("body", newNode);
			}
			if (doServerLog) {
				const newNode = t.expressionStatement(
					t.callExpression(
						t.memberExpression(t.identifier("console"), t.identifier("info")),
						[t.stringLiteral("SERVER LOGGING ENABLED")],
					),
				);

				path.unshiftContainer("body", newNode);
			}
		},
		VariableDeclarator(path) {
			if (!id.includes("@izumiano/vite-logger")) {
				return;
			}
			const declarator = path.node;
			if (
				declarator.id.type !== "Identifier" ||
				declarator.id.name !== "logUrl"
			) {
				return;
			}

			if (!doServerLog) {
				path.remove();
				return;
			}

			// biome-ignore lint/style/noNonNullAssertion: <doServerLog will be false (and therefore we have returned already) if logUrl is falsey>
			path.node.init = t.stringLiteral(logUrl!);
		},
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
		FunctionDeclaration(path) {
			if (doServerLog) {
				return;
			}
			const fnNode = path.node;
			const fnName = fnNode.id?.name;
			if (!fnName) {
				return;
			}
			if (!id.includes("@izumiano/vite-logger")) {
				return;
			}

			if (fnName === "handleExternalLogs" || fnName === "sendLogs") {
				// Generate empty function
				const newFn = t.functionDeclaration(
					t.identifier(fnName),
					fnNode.params,
					t.blockStatement([]),
				);

				path.replaceWith(newFn);
				path.skip();
			}
		},
	});

	return { code: generate(ast, {}, src).code, map: null };
}

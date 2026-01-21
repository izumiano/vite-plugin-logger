import generate from "@babel/generator";
import babelParser from "@babel/parser";
import { expect, it } from "vitest";
import match0Expect from "./testData/general/match_0.ts.expect?raw";
import match0Src from "./testData/general/match_0.ts.testdata?raw";
import { transformSrc } from "./transform";

// general
import mightThrowSrc from "./testData/general/might-throw.ts.testdata?raw";
import noThrowSrc from "./testData/general/no-throw.ts.testdata?raw";
// logger
import loggerMatch0Src from "./testData/vite-logger/match.ts.testdata?raw";
import loggerMatch0Expect0 from "./testData/vite-logger/match_0.ts.expect?raw";
import loggerMatch0Expect1 from "./testData/vite-logger/match_1.ts.expect?raw";
import loggerMatch0Expect2 from "./testData/vite-logger/match_2.ts.expect?raw";
import loggerMatch0Expect3 from "./testData/vite-logger/match_3.ts.expect?raw";
import loggerMatch0Expect4 from "./testData/vite-logger/match_4.ts.expect?raw";

it.each([
	{
		mode: "development",
		fileId: "@izumiano/vite-logger/index.ts",
		traceEnabled: true,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect0,
	},
	{
		mode: "development",
		fileId: "@izumiano/vite-logger/index.ts",
		traceEnabled: false,
		doServerLog: false,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect1,
	},
	{
		mode: "development",
		fileId: "@izumiano/vite-logger/index.ts",
		traceEnabled: true,
		doServerLog: false,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect2,
	},
	{
		mode: "development",
		fileId: "@izumiano/vite-logger/index.ts",
		traceEnabled: false,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect3,
	},
	{
		mode: "development",
		fileId: "index.ts",
		traceEnabled: false,
		doServerLog: false,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect4,
	},
	{
		mode: "development",
		fileId: "index.ts",
		traceEnabled: false,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect4,
	},
	{
		mode: "development",
		fileId: "index.ts",
		traceEnabled: true,
		doServerLog: false,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect4,
	},
	{
		mode: "development",
		fileId: "index.ts",
		traceEnabled: true,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: loggerMatch0Expect4,
	},
])("vite-logger | matches", ({
	mode,
	fileId,
	traceEnabled,
	doServerLog,
	logUrl,
	expected,
}) => {
	expect(
		transformSrc(loggerMatch0Src, fileId, {
			mode,
			traceEnabled,
			doServerLog,
			logUrl,
		}).code,
	).toBe(
		generate(
			babelParser.parse(expected, {
				sourceType: "module",
				plugins: ["typescript", "jsx"],
			}),
			{},
			expected,
		).code,
	);
});

it.each([
	{
		testData: match0Src,
		mode: "production",
		traceEnabled: true,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: match0Expect,
	},
	{
		testData: match0Src,
		mode: "development",
		traceEnabled: true,
		doServerLog: true,
		logUrl: "127.0.0.1:106",
		expected: match0Expect,
	},
])("general | matches", ({
	testData,
	mode,
	traceEnabled,
	doServerLog,
	logUrl,
	expected,
}) => {
	expect(
		transformSrc(testData, "index.ts", {
			mode,
			traceEnabled,
			doServerLog,
			logUrl,
		}).code,
	).toBe(
		generate(
			babelParser.parse(expected, {
				sourceType: "module",
				plugins: ["typescript", "jsx"],
			}),
			{},
			expected,
		).code,
	);
});

it.each([
	{
		testData: mightThrowSrc,
	},
])("general | does throw", ({ testData }) => {
	expect(() =>
		transformSrc(testData, "@izumiano/vite-logger/index.ts", {
			mode: "production",
			traceEnabled: true,
			doServerLog: true,
			logUrl: "127.0.0.1:106",
		}),
	).toThrow();
});

it.each([
	{
		testData: mightThrowSrc,
		mode: "development",
	},
	{
		testData: noThrowSrc,
		mode: "development",
	},
	{
		testData: noThrowSrc,
		mode: "production",
	},
])("general | doesn't throw", ({ testData, mode }) => {
	expect(() =>
		transformSrc(testData, "@izumiano/vite-logger/index.ts", {
			mode,
			traceEnabled: true,
			doServerLog: true,
			logUrl: "127.0.0.1:106",
		}),
	).not.toThrow();
});

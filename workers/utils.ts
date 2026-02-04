// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

const PST_TZ = "America/Los_Angeles";

/** Get the UTC Date for midnight on the given calendar date in PST */
function midnightPstUtc(year: number, month: number, day: number): Date {
	// PST = UTC-8, PDT = UTC-7. Try 8 first (PST).
	let d = new Date(Date.UTC(year, month - 1, day, 8, 0, 0, 0));
	const hour = new Intl.DateTimeFormat("en-US", {
		timeZone: PST_TZ,
		hour: "numeric",
		hour12: false,
	}).format(d);
	if (hour !== "0") d = new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0));
	return d;
}

/** Start of today (midnight) and start of tomorrow in PST, as UTC Dates */
export function getPstDayBounds(now: Date): {
	startOfTodayPst: Date;
	startOfTomorrowPst: Date;
	startOfDayAfterTomorrowPst: Date;
} {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: PST_TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
	const m = Number(parts.find((p) => p.type === "month")?.value ?? 1);
	const day = Number(parts.find((p) => p.type === "day")?.value ?? 1);
	const startOfTodayPst = midnightPstUtc(y, m, day);
	const startOfTomorrowPst = new Date(
		startOfTodayPst.getTime() + 24 * 60 * 60 * 1000,
	);
	const startOfDayAfterTomorrowPst = new Date(
		startOfTodayPst.getTime() + 2 * 24 * 60 * 60 * 1000,
	);
	return { startOfTodayPst, startOfTomorrowPst, startOfDayAfterTomorrowPst };
}

/** Current date and time in PST for display to the LLM */
export function getPstNowString(now: Date = new Date()): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: PST_TZ,
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(now);
}

import type {
	CoreMessage,
	ToolSet,
	UIMessage,
	UIMessageStreamWriter,
} from "ai";
import { convertToModelMessages, isToolUIPart } from "ai";
import { APPROVAL } from "./shared";

interface ToolContext {
	messages: CoreMessage[];
	toolCallId: string;
}

function isValidToolName<K extends PropertyKey, T extends object>(
	key: K,
	obj: T,
): key is K & keyof T {
	return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 */
export async function processToolCalls<Tools extends ToolSet>({
	dataStream,
	messages,
	executions,
}: {
	tools: Tools; // used for type inference
	dataStream: UIMessageStreamWriter;
	messages: UIMessage[];
	executions: Record<
		string,
		// biome-ignore lint/suspicious/noExplicitAny: needs a better type
		(args: any, context: ToolContext) => Promise<unknown>
	>;
}): Promise<UIMessage[]> {
	// Process all messages, not just the last one
	const processedMessages = await Promise.all(
		messages.map(async (message) => {
			const parts = message.parts;
			if (!parts) return message;

			const processedParts = await Promise.all(
				parts.map(async (part) => {
					// Only process tool UI parts
					if (!isToolUIPart(part)) return part;

					const toolName = part.type.replace(
						"tool-",
						"",
					) as keyof typeof executions;

					// Only process tools that require confirmation (are in executions object) and are in 'input-available' state
					if (!(toolName in executions) || part.state !== "input-available")
						return part;

					let result: unknown;

					if (part.input === APPROVAL.YES) {
						// User approved the tool execution
						if (!isValidToolName(toolName, executions)) {
							return part;
						}

						const toolInstance = executions[toolName];
						if (toolInstance) {
							result = await toolInstance(part.input, {
								messages: convertToModelMessages(messages),
								toolCallId: part.toolCallId,
							});
						} else {
							result = "Error: No execute function found on tool";
						}
					} else if (part.input === APPROVAL.NO) {
						result = "Error: User denied access to tool execution";
					} else {
						// If no approval input yet, leave the part as-is for user interaction
						return part;
					}

					// Forward updated tool result to the client.
					dataStream.write({
						type: "data-tool-result",
						data: {
							toolCallId: part.toolCallId,
							result: result,
						},
					});

					// Return updated tool part with the actual result.
					return {
						...part,
						state: "output-available" as const,
						output: result,
					};
				}),
			);

			return { ...message, parts: processedParts };
		}),
	);

	return processedMessages;
}

/**
 * Clean up incomplete tool calls from messages before sending to API
 * Prevents API errors from interrupted or failed tool executions
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
	return messages.filter((message) => {
		if (!message.parts) return true;

		// Filter out messages with incomplete tool calls
		const hasIncompleteToolCall = message.parts.some((part) => {
			if (!isToolUIPart(part)) return false;
			// Remove tool calls that are still streaming or awaiting input without results
			return (
				part.state === "input-streaming" ||
				(part.state === "input-available" && !part.output && !part.errorText)
			);
		});

		return !hasIncompleteToolCall;
	});
}

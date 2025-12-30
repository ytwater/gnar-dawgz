/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import type { ToolSet } from "ai";

import { cancelScheduledTask } from "./cancelScheduledTask";
import { getLocalTime } from "./getLocalTime";
import { getScheduledTasks } from "./getScheduledTasks";
import {
	getWeatherInformation,
	getWeatherInformationExecute,
} from "./getWeatherInformation";
import { scheduleTask } from "./scheduleTask";
import { sendTestNotification } from "./sendTestNotification";

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
// export const tools = {
// 	getWeatherInformation,
// 	getLocalTime,
// 	scheduleTask,
// 	getScheduledTasks,
// 	cancelScheduledTask,
// 	sendTestNotification,
// 	updateUserName,
// } satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
	getWeatherInformation: getWeatherInformationExecute,
	// updateUserName: updateUserNameExecute,
};

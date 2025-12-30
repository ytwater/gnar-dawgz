import { getWeatherInformationExecute } from "./getWeatherInformation";

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

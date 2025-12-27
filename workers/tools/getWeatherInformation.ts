/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
import { tool } from "ai";
import { z } from "zod";

export const getWeatherInformation = tool({
	description: "show the weather in a given city to the user",
	inputSchema: z.object({ city: z.string() }),
	// Omitting execute function makes this tool require human confirmation
});

export const getWeatherInformationExecute = async ({ city }: { city: string }) => {
	console.log(`Getting weather information for ${city}`);
	return `The weather in ${city} is sunny`;
};


import { pushRouter } from "./routers/push-router";
import { surfForecastRouter } from "./routers/surf-forecast-router";
import { twilioRouter } from "./routers/twilio-router";
import { whatsappRouter } from "./routers/whatsapp-router";

export const appRouter = {
	push: pushRouter,
	twilio: twilioRouter,
	whatsapp: whatsappRouter,
	surfForecast: surfForecastRouter,
};

export type AppRouter = typeof appRouter;

import { pushRouter } from "./routers/push-router";
import { twilioRouter } from "./routers/twilio-router";
import { whatsappRouter } from "./routers/whatsapp-router";

export const appRouter = {
	push: pushRouter,
	twilio: twilioRouter,
	whatsapp: whatsappRouter,
};

export type AppRouter = typeof appRouter;

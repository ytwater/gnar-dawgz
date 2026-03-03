import { demeritRouter } from "./routers/demerit-router";
import { profileImageRouter } from "./routers/profile-image-router";
import { pushRouter } from "./routers/push-router";
import { surfForecastRouter } from "./routers/surf-forecast-router";
import { whatsappRouter } from "./routers/whatsapp-router";

export const appRouter = {
	push: pushRouter,
	whatsapp: whatsappRouter,
	surfForecast: surfForecastRouter,
	demerit: demeritRouter,
	profileImage: profileImageRouter,
};

export type AppRouter = typeof appRouter;

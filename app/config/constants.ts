export const ADMIN_USER_IDS: string[] = [
	"ZvUmzplbR8KA82sSPom7UmkrgTM9XtXp", // ytwater Dev
	"vtpk6yV3s0xpTafnEJEC2IA8DKJHBzjd", // ytwater Prod
] as const;
export const APP_URL_PROD = "https://www.gnardawgs.surf" as const;
export const APP_URL_DEV = "http://localhost:5173" as const;
export const getAppUrl = (env: CloudflareBindings) => {
	return env.ENVIRONMENT === "dev" ? APP_URL_DEV : APP_URL_PROD;
};

export const SURFLINE_TORREY_PINES_SPOT_ID =
	"584204204e65fad6a7709994" as const;

/** WAHA Core supports only this session; WAHA Plus supports multiple. Use for all WAHA API calls. */
export const WAHA_SESSION_NAME = "default" as const;

export const REQUIRED_ENV_VARS = [
	"OPENAI_API_KEY",
	"DEEPSEEK_API_KEY",
	"CLOUDFLARE_API_TOKEN",
	"GEMINI_API_KEY",
	"BETTER_AUTH_SECRET",
	"GOOGLE_CLIENT_SECRET",
	"VAPID_PUBLIC_KEY",
	"VAPID_PRIVATE_KEY",
	"SWELL_CLOUD_API_KEY",
] as const;

export const TORREY_PILES_LAT_LNG = {
	lat: 32.927,
	lng: -117.26,
} as const;

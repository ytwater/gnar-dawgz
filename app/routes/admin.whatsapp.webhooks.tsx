import * as React from "react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import {
	useActionData,
	useLoaderData,
	useNavigation,
	useSubmit,
} from "react-router";
import { toast } from "sonner";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Input } from "~/app/components/ui/input";
import { WAHA_SESSION_NAME, getAppUrl } from "~/app/config/constants";
import type { SessionInfo, WebhookConfig } from "~/app/lib/whatsapp/models";
import {
	sessionsControllerGet,
	sessionsControllerUpdate,
} from "~/app/lib/whatsapp/whatsapp-api";

// WAHA valid events (no group.upsert/group.update); see API validation
const DEFAULT_EVENTS = [
	"message",
	"message.any",
	"group.v2.join",
	"group.v2.leave",
	"group.v2.update",
	"group.v2.participants",
];

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const env = context.cloudflare.env;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		return { error: "WAHA_API_KEY is not configured" };
	}

	const fetchOptions = {
		headers: {
			"X-Api-Key": apiKey,
		},
	};

	try {
		console.log("[Webhooks Loader] GET session", {
			sessionName: WAHA_SESSION_NAME,
		});
		const sessionRes = await sessionsControllerGet(
			{},
			WAHA_SESSION_NAME,
			fetchOptions,
		);
		const session = sessionRes.data as SessionInfo;
		console.log("[Webhooks Loader] GET session result", {
			status: sessionRes.status,
			data: session,
			webhooks: session?.config?.webhooks,
		});
		const appUrl = getAppUrl(env);
		return {
			session,
			recommendedUrl: `${appUrl}/api/waha/webhook`,
		};
	} catch (error) {
		console.error("Webhooks Loader Error:", error);
		return { error: "Failed to fetch session" };
	}
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const env = context.cloudflare.env;
	const apiKey = env.WAHA_API_KEY;

	if (!apiKey) {
		return data({ error: "WAHA_API_KEY is not configured" }, { status: 400 });
	}

	const fetchOptions = {
		headers: {
			"X-Api-Key": apiKey,
		},
	};

	const formData = await request.formData();
	// Read URLs from named inputs so payload comes from DOM, not React state
	const urls = (formData.getAll("webhookUrl") as string[])
		.map((u) => String(u).trim())
		.filter(Boolean);

	const webhooks = urls.map((url) => ({
		url,
		events: DEFAULT_EVENTS as unknown as WebhookConfig["events"],
	}));

	try {
		console.log("[Webhooks Action] GET session (before update)", {
			sessionName: WAHA_SESSION_NAME,
			webhooksToSave: webhooks,
		});
		const sessionRes = await sessionsControllerGet(
			{},
			WAHA_SESSION_NAME,
			fetchOptions,
		);
		const existing = (sessionRes.data as SessionInfo)?.config;
		console.log("[Webhooks Action] GET session result", {
			status: sessionRes.status,
			existingConfig: existing,
		});
		const updatePayload = {
			config: {
				...(existing && typeof existing === "object" ? existing : {}),
				webhooks,
			},
		};
		console.log("[Webhooks Action] PUT session", {
			sessionName: WAHA_SESSION_NAME,
			payload: updatePayload,
		});
		const updateRes = await sessionsControllerUpdate(
			updatePayload,
			WAHA_SESSION_NAME,
			fetchOptions,
		);
		console.log("[Webhooks Action] PUT session result", {
			status: updateRes.status,
			data: updateRes.data,
		});
		return { success: "Webhooks updated successfully" };
	} catch (error) {
		console.error("Webhooks Action Error:", error);
		return data({ error: "Failed to update webhooks" }, { status: 500 });
	}
};

export default function AdminWhatsAppWebhooks() {
	const dataRaw = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state !== "idle";

	if ("error" in dataRaw) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-destructive">{dataRaw.error}</p>
				</CardContent>
			</Card>
		);
	}

	const { session } = dataRaw;
	const existingWebhooks: WebhookConfig[] =
		(session?.config as SessionInfo["config"])?.webhooks ?? [];
	const initialUrls =
		existingWebhooks.length > 0 ? existingWebhooks.map((w) => w.url) : [""];

	const fillRecommendedRef = React.useRef<((url: string) => void) | null>(null);

	useEffect(() => {
		if (actionData && "success" in actionData) {
			toast.success(actionData.success);
		} else if (actionData && "error" in actionData) {
			toast.error(actionData.error);
		}
	}, [actionData]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Webhook Configuration</CardTitle>
					<CardDescription>
						Configure where WAHA should send incoming message events. You can
						add multiple webhook URLs; each will receive the same events.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<WebhookForm
						key={JSON.stringify(initialUrls)}
						initialUrls={initialUrls}
						isSubmitting={isSubmitting}
						onFillRecommendedRef={fillRecommendedRef}
					/>
				</CardContent>
			</Card>

			{dataRaw.recommendedUrl &&
				!initialUrls.includes(dataRaw.recommendedUrl) && (
					<Card className="border-primary/50 bg-primary/5">
						<CardHeader>
							<CardTitle className="text-sm font-medium">
								Recommended Webhook
							</CardTitle>
							<CardDescription>
								The Gnar Dawgs bot logic is now served at a new endpoint.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex items-center justify-between gap-4">
							<code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
								{dataRaw.recommendedUrl}
							</code>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const url = dataRaw.recommendedUrl ?? "";
									if (fillRecommendedRef.current) {
										fillRecommendedRef.current(url);
									} else {
										navigator.clipboard.writeText(url);
										toast.info("Copied to clipboard! Add it manually.");
									}
								}}
							>
								Use This
							</Button>
						</CardContent>
					</Card>
				)}
		</div>
	);
}

type WebhookFormValues = { urls: { value: string }[] };

function WebhookForm({
	initialUrls,
	isSubmitting,
	onFillRecommendedRef,
}: {
	initialUrls: string[];
	isSubmitting: boolean;
	onFillRecommendedRef?: React.MutableRefObject<((url: string) => void) | null>;
}) {
	const submit = useSubmit();
	const { control, handleSubmit, setValue, getValues } =
		useForm<WebhookFormValues>({
			defaultValues: {
				urls:
					initialUrls.length > 0
						? initialUrls.map((value) => ({ value }))
						: [{ value: "" }],
			},
		});
	const { fields, append, remove } = useFieldArray({ control, name: "urls" });

	React.useEffect(() => {
		if (!onFillRecommendedRef) return;
		onFillRecommendedRef.current = (url: string) => {
			const urls = getValues("urls");
			const i = urls.findIndex((u) => !u?.value?.trim());
			if (i >= 0) {
				setValue(`urls.${i}.value`, url);
			} else {
				append({ value: "" });
				setValue(`urls.${urls.length}.value`, url);
			}
		};
		return () => {
			onFillRecommendedRef.current = null;
		};
	}, [onFillRecommendedRef, setValue, getValues, append]);

	const onSubmit = handleSubmit((values) => {
		const fd = new FormData();
		for (const { value } of values.urls) {
			const trimmed = String(value ?? "").trim();
			if (trimmed) fd.append("webhookUrl", trimmed);
		}
		submit(fd, { method: "post" });
	});

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<div className="space-y-4">
				{fields.map((field, index) => (
					<div key={field.id} className="flex items-center gap-2">
						<Input
							{...control.register(`urls.${index}.value`)}
							placeholder="https://your-app.com/api/whatsapp/webhook"
							className="flex-1"
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => remove(index)}
							disabled={fields.length <= 1}
							aria-label="Remove webhook"
						>
							−
						</Button>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => append({ value: "" })}
				>
					+ Add webhook URL
				</Button>
			</div>
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? "Saving..." : "Update Webhooks"}
			</Button>
		</form>
	);
}

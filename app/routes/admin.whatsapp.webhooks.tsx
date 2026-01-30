import * as React from "react";
import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { useActionData, useLoaderData, useNavigation } from "react-router";
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
import { getAppUrl } from "~/app/config/constants";
import type { SessionInfo, WebhookConfig } from "~/app/lib/whatsapp/models";
import {
	sessionsControllerGet,
	sessionsControllerUpdate,
} from "~/app/lib/whatsapp/whatsapp-api";

const DEFAULT_EVENTS = [
	"message",
	"message.any",
	"group.upsert",
	"group.update",
];

export const loader = async ({ context }: LoaderFunctionArgs) => {
	const env = context.cloudflare.env;
	const sessionName = env.WAHA_SESSION_ID || "default";
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
		const sessionRes = await sessionsControllerGet(
			{},
			sessionName,
			fetchOptions,
		);
		const appUrl = getAppUrl(env);
		return {
			session: sessionRes.data as SessionInfo,
			recommendedUrl: `${appUrl}/api/waha/webhook`,
		};
	} catch (error) {
		console.error("Webhooks Loader Error:", error);
		return { error: "Failed to fetch session" };
	}
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const env = context.cloudflare.env;
	const sessionName = env.WAHA_SESSION_ID || "default";
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
	const webhookUrlsJson = formData.get("webhookUrlsJson") as string | null;
	let urls: string[] = [];
	if (webhookUrlsJson) {
		try {
			const parsed = JSON.parse(webhookUrlsJson) as string[];
			urls = Array.isArray(parsed)
				? parsed.map((u) => String(u).trim()).filter(Boolean)
				: [];
		} catch {
			// ignore invalid JSON
		}
	}
	if (urls.length === 0) {
		// fallback: single webhookUrl field (legacy or no JS)
		const single = (formData.get("webhookUrl") as string)?.trim();
		if (single) urls = [single];
	}

	try {
		await sessionsControllerUpdate(
			{
				config: {
					webhooks: urls.map((url) => ({
						url,
						events: DEFAULT_EVENTS as unknown as WebhookConfig["events"],
					})),
				},
			},
			sessionName,
			fetchOptions,
		);
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
					<WebhookForm initialUrls={initialUrls} isSubmitting={isSubmitting} />
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
									const input = document.querySelector(
										'input[placeholder="https://your-app.com/api/whatsapp/webhook"]',
									) as HTMLInputElement;
									if (input && !input.value) {
										input.value = dataRaw.recommendedUrl || "";
										// Trigger React state update by dispatching an event
										const event = new Event("input", { bubbles: true });
										input.dispatchEvent(event);
									} else {
										// If first one is filled, toast the recommendation or just tell them to copy
										navigator.clipboard.writeText(dataRaw.recommendedUrl || "");
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

function WebhookForm({
	initialUrls,
	isSubmitting,
}: {
	initialUrls: string[];
	isSubmitting: boolean;
}) {
	const [urls, setUrls] = React.useState<string[]>(initialUrls);
	const [rowIds, setRowIds] = React.useState<number[]>(() =>
		initialUrls.map((_, i) => i),
	);
	const nextIdRef = React.useRef(initialUrls.length);

	const addRow = () => {
		setUrls((prev) => [...prev, ""]);
		setRowIds((prev) => [...prev, nextIdRef.current++]);
	};
	const removeRow = (index: number) => {
		setUrls((prev) => prev.filter((_, i) => i !== index));
		setRowIds((prev) => prev.filter((_, i) => i !== index));
	};
	const setUrl = (index: number, value: string) =>
		setUrls((prev) => {
			const next = [...prev];
			next[index] = value;
			return next;
		});

	return (
		<form method="post" className="space-y-6">
			<input
				type="hidden"
				name="webhookUrlsJson"
				value={JSON.stringify(urls)}
			/>
			<div className="space-y-4">
				{urls.map((url, index) => (
					<div key={rowIds[index]} className="flex items-center gap-2">
						<Input
							value={url}
							onChange={(e) => setUrl(index, e.target.value)}
							placeholder="https://your-app.com/api/whatsapp/webhook"
							className="flex-1"
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => removeRow(index)}
							disabled={urls.length <= 1}
							aria-label="Remove webhook"
						>
							−
						</Button>
					</div>
				))}
				<Button type="button" variant="outline" size="sm" onClick={addRow}>
					+ Add webhook URL
				</Button>
			</div>
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? "Saving..." : "Update Webhooks"}
			</Button>
		</form>
	);
}

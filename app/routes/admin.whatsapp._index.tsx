import { IdentificationCard } from "@phosphor-icons/react";
import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
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
import { Label } from "~/app/components/ui/label";
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import type { MyProfile } from "~/app/lib/whatsapp/models";
import { profileControllerGetMyProfile } from "~/app/lib/whatsapp/whatsapp-api";

interface LocalMyProfile extends MyProfile {
	about?: string;
}

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
		const profileRes = await profileControllerGetMyProfile(
			WAHA_SESSION_NAME,
			fetchOptions,
		);
		return { profile: profileRes.data as LocalMyProfile };
	} catch (error) {
		console.error("Profile Loader Error:", error);
		return { error: "Failed to fetch profile" };
	}
};

export default function AdminWhatsAppProfile() {
	const dataRaw = useLoaderData<typeof loader>();
	const fetcher = useFetcher<{ success?: string; error?: string }>();
	const isSubmitting = fetcher.state !== "idle";

	if ("error" in dataRaw) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-destructive">{dataRaw.error}</p>
				</CardContent>
			</Card>
		);
	}

	const { profile } = dataRaw;

	useEffect(() => {
		if (fetcher.data?.success) {
			toast.success(fetcher.data.success);
		} else if (fetcher.data?.error) {
			toast.error(fetcher.data.error);
		}
	}, [fetcher.data]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>WhatsApp Profile</CardTitle>
				<CardDescription>
					Update your WhatsApp identity and about info.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<fetcher.Form
					action="/admin/whatsapp/profile-action"
					method="post"
					className="space-y-6"
					encType="multipart/form-data"
				>
					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex flex-col items-center gap-4">
							{profile?.picture ? (
								<img
									src={profile.picture}
									alt="Profile"
									className="w-32 h-32 rounded-full border shadow-sm object-cover"
								/>
							) : (
								<div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border border-dashed text-muted-foreground">
									<IdentificationCard size={48} />
								</div>
							)}
							<div className="space-y-2 w-full">
								<Label htmlFor="picture">Profile Picture</Label>
								<Input
									id="picture"
									name="picture"
									type="file"
									accept="image/*"
									className="cursor-pointer"
								/>
							</div>
						</div>
						<div className="flex-1 grid gap-4">
							<div className="space-y-2">
								<Label htmlFor="name">Display Name</Label>
								<Input
									id="name"
									name="name"
									defaultValue={profile?.name || ""}
									placeholder="Public name"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="about">About / Status</Label>
								<Input
									id="about"
									name="about"
									defaultValue={profile?.about || ""}
									placeholder="Hey there! I am using WhatsApp."
								/>
							</div>
						</div>
					</div>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Saving..." : "Save Profile Changes"}
					</Button>
				</fetcher.Form>
			</CardContent>
		</Card>
	);
}

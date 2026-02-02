import { IdentificationCard } from "@phosphor-icons/react";
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
import { Label } from "~/app/components/ui/label";
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import type { MyProfile } from "~/app/lib/whatsapp/models";
import {
	profileControllerGetMyProfile,
	profileControllerSetProfileName,
	profileControllerSetProfilePicture,
	profileControllerSetProfileStatus,
} from "~/app/lib/whatsapp/whatsapp-api";

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
	const name = formData.get("name") as string;
	const about = formData.get("about") as string;
	const pictureFile = formData.get("picture") as File | null;

	try {
		if (name) {
			await profileControllerSetProfileName(
				{ name },
				WAHA_SESSION_NAME,
				fetchOptions,
			);
		}
		if (about) {
			await profileControllerSetProfileStatus(
				{ status: about },
				WAHA_SESSION_NAME,
				fetchOptions,
			);
		}
		if (pictureFile && pictureFile.size > 0) {
			const buffer = await pictureFile.arrayBuffer();
			// @ts-ignore - Buffer from nodejs_compat
			const base64 = Buffer.from(buffer).toString("base64");
			await profileControllerSetProfilePicture(
				{
					file: {
						mimetype: pictureFile.type,
						data: base64,
						filename: pictureFile.name,
					},
				},
				WAHA_SESSION_NAME,
				fetchOptions,
			);
		}
		return { success: "Profile updated successfully" };
	} catch (error) {
		console.error("Profile Action Error:", error);
		return data({ error: "Failed to update profile" }, { status: 500 });
	}
};

export default function AdminWhatsAppProfile() {
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

	const { profile } = dataRaw;

	useEffect(() => {
		if (actionData && "success" in actionData) {
			toast.success(actionData.success);
		} else if (actionData && "error" in actionData) {
			toast.error(actionData.error);
		}
	}, [actionData]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>WhatsApp Profile</CardTitle>
				<CardDescription>
					Update your WhatsApp identity and about info.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form method="post" className="space-y-6" encType="multipart/form-data">
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
				</form>
			</CardContent>
		</Card>
	);
}

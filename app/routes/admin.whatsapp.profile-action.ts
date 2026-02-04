import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import { WAHA_SESSION_NAME } from "~/app/config/constants";
import {
	profileControllerSetProfileName,
	profileControllerSetProfilePicture,
	profileControllerSetProfileStatus,
} from "~/app/lib/whatsapp/whatsapp-api";

export const loader = async (_args: LoaderFunctionArgs) => {
	return redirect("/admin/whatsapp");
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

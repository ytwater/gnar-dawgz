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
		const errors: string[] = [];

		if (name) {
			const res = await profileControllerSetProfileName(
				{ name },
				WAHA_SESSION_NAME,
				fetchOptions,
			);
			if (
				res.status !== 200 ||
				(res.data as { success?: boolean })?.success === false
			) {
				const msg =
					(res.data as { message?: string })?.message ??
					"Failed to update name";
				console.error("Failed to update profile name", {
					status: res.status,
					data: res.data,
				});
				errors.push(msg);
			}
		}

		if (about) {
			const res = await profileControllerSetProfileStatus(
				{ status: about },
				WAHA_SESSION_NAME,
				fetchOptions,
			);
			if (
				res.status !== 200 ||
				(res.data as { success?: boolean })?.success === false
			) {
				const msg =
					(res.data as { message?: string })?.message ??
					"Failed to update status";
				console.error("Failed to update profile status", {
					status: res.status,
					data: res.data,
				});
				errors.push(msg);
			}
		}

		if (pictureFile && pictureFile.size > 0) {
			const buffer = await pictureFile.arrayBuffer();
			// @ts-ignore - Buffer from nodejs_compat
			const base64 = Buffer.from(buffer).toString("base64");
			const res = await profileControllerSetProfilePicture(
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

			if (
				res.status !== 200 ||
				(res.data as { success?: boolean })?.success === false
			) {
				const msg =
					(res.data as { message?: string })?.message ??
					"Failed to update profile picture";
				console.error("Failed to update profile picture", {
					status: res.status,
					data: res.data,
				});
				errors.push(msg);
			}
		}

		if (errors.length > 0) {
			// Return 200 so the body is always passed to the fetcher (5xx can be swallowed)
			return data({ error: errors.join(" ") });
		}

		return data({ success: "Profile updated successfully" });
	} catch (error) {
		console.error("Profile Action Error:", error);
		return data({ error: "Failed to update profile" }, { status: 500 });
	}
};

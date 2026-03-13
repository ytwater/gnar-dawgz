import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../../auth-schema";
import { profileImages } from "../../profile-image-schema";
import { adminProcedure } from "../server";

export const adminRouter = {
	deleteUser: adminProcedure
		.input(z.object({ userId: z.string() }))
		.handler(async ({ input, context }) => {
			const { userId } = input;

			// Collect all R2 keys for this user's profile images
			const images = await context.db
				.select({
					originalUrl: profileImages.originalUrl,
					stylizedDogUrl: profileImages.stylizedDogUrl,
					fullLogoUrl: profileImages.fullLogoUrl,
				})
				.from(profileImages)
				.where(eq(profileImages.userId, userId));

			const keysToDelete = images.flatMap(
				(img) =>
					[img.originalUrl, img.stylizedDogUrl, img.fullLogoUrl].filter(
						Boolean,
					) as string[],
			);

			// Single batch R2 delete call regardless of image count
			if (keysToDelete.length > 0) {
				await context.env.PROFILE_IMAGES_BUCKET.delete(keysToDelete);
			}

			// Delete user — cascades to sessions, accounts, profile_images rows
			await context.db.delete(users).where(eq(users.id, userId));

			return { success: true };
		}),
};

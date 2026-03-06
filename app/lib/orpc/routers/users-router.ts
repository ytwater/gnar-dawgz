import { asc } from "drizzle-orm";
import { users } from "../../schema";
import { authedProcedure } from "../server";

export const usersRouter = {
	listPackMembers: authedProcedure.handler(async ({ context }) => {
		return await context.db
			.select({
				id: users.id,
				name: users.name,
				image: users.image,
				role: users.role,
			})
			.from(users)
			.orderBy(asc(users.name));
	}),
};

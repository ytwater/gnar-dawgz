import { desc, eq } from "drizzle-orm";
import { Form, redirect, useLoaderData } from "react-router";
import { accessRequests } from "~/app/lib/app-schema";
import { createAuth } from "~/app/lib/auth";
import { getDb } from "~/app/lib/db";
import type { Route } from "../+types/admin";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw redirect("/login");
	}

	// TODO: Add stricter admin role check here
	// if (session.user.role !== "admin") throw redirect("/");

	const db = getDb(context.cloudflare.env.DB);
	const results = await db.query.accessRequests.findMany({
		where: eq(accessRequests.status, "pending"),
		orderBy: desc(accessRequests.createdAt),
	});

	return { requests: results, user: session.user };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const auth = createAuth(context.cloudflare.env, request.cf);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return redirect("/login");

	const formData = await request.formData();
	const intent = formData.get("intent");
	const requestId = formData.get("requestId") as string;
	const email = formData.get("email") as string;

	const db = getDb(context.cloudflare.env.DB);

	if (intent === "approve") {
		try {
			// Create the user in better-auth so they can login.
			// We use a random password since they will likely use Google Auth
			// (or we can send them an invite link if we had email set up, but simpler to just pre-create).
			// NOTE: better-auth might require password for email credential, but we are just creating the user record.
			// biome-ignore lint/suspicious/noExplicitAny: better-auth admin API types can be inconsistent
			await (auth.api as any).admin.createUser({
				body: {
					email: email,
					password: crypto.randomUUID(),
					name: email.split("@")[0],
					role: "user",
				},
			});

			await db
				.update(accessRequests)
				.set({ status: "approved" })
				.where(eq(accessRequests.id, requestId));
		} catch (e) {
			console.error("Failed to create user", e);
			return { error: "Failed to create user. They might already exist." };
		}
	} else if (intent === "reject") {
		await db
			.update(accessRequests)
			.set({ status: "rejected" })
			.where(eq(accessRequests.id, requestId));
	}

	return { success: true };
};

interface AccessRequest {
	id: string;
	email: string;
	reason: string;
	status: string;
	createdAt: string | Date;
}

export default function ApproveAccess() {
	const { requests } = useLoaderData<typeof loader>();

	return (
		<div className="space-y-8">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight text-white">
						Access Requests
					</h1>
					<p className="mt-2 text-gray-400">
						Approve or reject pending access requests.
					</p>
				</div>
			</div>

			<div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-white/10">
						<thead className="bg-[#111]">
							<tr>
								<th
									scope="col"
									className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"
								>
									Email
								</th>
								<th
									scope="col"
									className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"
								>
									Reason
								</th>
								<th
									scope="col"
									className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"
								>
									Requested
								</th>
								<th
									scope="col"
									className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{(requests as unknown as AccessRequest[]).length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="px-6 py-12 text-center text-gray-500"
									>
										No pending requests
									</td>
								</tr>
							) : (
								(requests as unknown as AccessRequest[]).map((request) => (
									<tr
										key={request.id}
										className="hover:bg-white/5 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
											{request.email}
										</td>
										<td className="px-6 py-4 whitespace-normal text-sm text-gray-400 max-w-xs">
											{request.reason}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
											{new Date(request.createdAt).toLocaleDateString()}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
											<div className="flex justify-end gap-3">
												<Form method="post" className="inline">
													<input
														type="hidden"
														name="requestId"
														value={request.id}
													/>
													<input
														type="hidden"
														name="email"
														value={request.email}
													/>
													<button
														type="submit"
														name="intent"
														value="approve"
														className="text-green-500 hover:text-green-400 transition-colors"
													>
														Approve
													</button>
												</Form>
												<Form method="post" className="inline">
													<input
														type="hidden"
														name="requestId"
														value={request.id}
													/>
													<button
														type="submit"
														name="intent"
														value="reject"
														className="text-red-500 hover:text-red-400 transition-colors"
													>
														Reject
													</button>
												</Form>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

import { desc, eq } from "drizzle-orm";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { accessRequests } from "~/lib/app-schema";
import { createAuth } from "~/lib/auth";
import { getDb } from "~/lib/db";
import type { Route } from "./+types/admin";

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
	const { requests, user } = useLoaderData<typeof loader>();

	return (
		<div className="min-h-screen bg-gray-100">
			<nav className="bg-white shadow-sm">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-between">
						<div className="flex">
							<div className="flex flex-shrink-0 items-center">
								<span className="text-xl font-bold text-indigo-600">
									Gnar Dawgs Admin
								</span>
							</div>
						</div>
						<div className="flex items-center">
							<span className="text-sm text-gray-500 mr-4">
								Signed in as {user.name || user.email}
							</span>
							<Link
								to="/"
								className="text-sm font-medium text-gray-500 hover:text-gray-900"
							>
								Home
							</Link>
						</div>
					</div>
				</div>
			</nav>

			<div className="py-10">
				<main>
					<div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
						<div className="md:flex md:items-center md:justify-between">
							<div className="min-w-0 flex-1">
								<h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
									Access Requests
								</h2>
							</div>
						</div>

						<div className="mt-8 flow-root">
							<div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
								<div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
									<div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
										<table className="min-w-full divide-y divide-gray-300">
											<thead className="bg-gray-50">
												<tr>
													<th
														scope="col"
														className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
													>
														Email
													</th>
													<th
														scope="col"
														className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
													>
														Reason
													</th>
													<th
														scope="col"
														className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
													>
														Requested
													</th>
													<th
														scope="col"
														className="relative py-3.5 pl-3 pr-4 sm:pr-6"
													>
														<span className="sr-only">Actions</span>
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-200 bg-white">
												{(requests as unknown as AccessRequest[]).length ===
												0 ? (
													<tr>
														<td
															colSpan={4}
															className="py-4 text-center text-sm text-gray-500"
														>
															No pending requests
														</td>
													</tr>
												) : (
													(requests as unknown as AccessRequest[]).map(
														(request) => (
															<tr key={request.id}>
																<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
																	{request.email}
																</td>
																<td className="whitespace-normal px-3 py-4 text-sm text-gray-500 max-w-xs">
																	{request.reason}
																</td>
																<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
																	{new Date(
																		request.createdAt,
																	).toLocaleDateString()}
																</td>
																<td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
																	<div className="flex justify-end gap-2">
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
																				className="text-green-600 hover:text-green-900"
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
																				className="text-red-600 hover:text-red-900"
																			>
																				Reject
																			</button>
																		</Form>
																	</div>
																</td>
															</tr>
														),
													)
												)}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}

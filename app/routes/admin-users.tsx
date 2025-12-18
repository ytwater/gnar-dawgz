import {
	CheckCircle,
	Crown,
	MagnifyingGlass,
	Prohibit,
	Shield,
	Trash,
	UserCircle,
	Users,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Form, Link, redirect, useLoaderData, useSubmit } from "react-router";
import { ADMIN_USER_IDS } from "~/config/constants";
import { createAuth } from "~/lib/auth";
import type { Route } from "./+types/admin-users";

type AdminUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	banned?: boolean;
	image?: string;
	createdAt: string | Date;
};

interface CloudflareRequest extends Request {
	cf?: unknown;
}

export const loader = async ({ request, context }: Route.LoaderArgs) => {
	const auth = createAuth(
		context.cloudflare.env,
		(request as unknown as CloudflareRequest).cf,
	);
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session) {
		throw redirect("/login");
	}

	const user = session.user as unknown as AdminUser;

	// The admin plugin check
	if (user.role !== "admin" && !ADMIN_USER_IDS.includes(user.id)) {
		throw redirect("/");
	}

	const adminApi = auth.api.admin;
	const { users } = await adminApi.listUsers({
		query: {
			limit: 100,
		},
	});

	return { users: users as AdminUser[], currentUser: user };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
	const auth = createAuth(
		context.cloudflare.env,
		(request as unknown as CloudflareRequest).cf,
	);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return redirect("/login");

	const user = session.user as unknown as AdminUser;
	if (user.role !== "admin" && !ADMIN_USER_IDS.includes(user.id))
		return redirect("/login");

	const formData = await request.formData();
	const intent = formData.get("intent");
	const userId = formData.get("userId") as string;

	// biome-ignore lint/suspicious/noExplicitAny: better-auth admin API types
	const adminApi = (auth.api as any).admin;

	if (intent === "update-role") {
		const role = formData.get("role") as string;
		await adminApi.setRole({
			body: {
				userId,
				role,
			},
		});
	} else if (intent === "ban") {
		await adminApi.banUser({
			body: {
				userId,
			},
		});
	} else if (intent === "unban") {
		await adminApi.unbanUser({
			body: {
				userId,
			},
		});
	} else if (intent === "delete") {
		await adminApi.removeUser({
			body: {
				userId,
			},
		});
	}

	return { success: true };
};

export default function AdminUsers() {
	const { users, currentUser } = useLoaderData<typeof loader>();
	const [search, setSearch] = useState("");
	const submit = useSubmit();

	const filteredUsers = users.filter(
		(u) =>
			u.email?.toLowerCase().includes(search.toLowerCase()) ||
			u.name?.toLowerCase().includes(search.toLowerCase()),
	);

	const handleRoleChange = (userId: string, role: string) => {
		const formData = new FormData();
		formData.append("intent", "update-role");
		formData.append("userId", userId);
		formData.append("role", role);
		submit(formData, { method: "post" });
	};

	const handleBanToggle = (userId: string, isBanned: boolean) => {
		const formData = new FormData();
		formData.append("intent", isBanned ? "unban" : "ban");
		formData.append("userId", userId);
		submit(formData, { method: "post" });
	};

	return (
		<div className="min-h-screen bg-[#0a0a0a] text-white">
			<nav className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-between items-center">
						<div className="flex items-center gap-2">
							<Shield className="w-8 h-8 text-indigo-500" weight="fill" />
							<span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
								Gnar Dawgs Admin
							</span>
						</div>
						<div className="flex items-center gap-6">
							<div className="text-sm font-medium text-gray-400">
								<span className="hidden sm:inline">Admin:</span>{" "}
								{currentUser.email}
							</div>
							<Link
								to="/"
								className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
							>
								Home
							</Link>
						</div>
					</div>
				</div>
			</nav>

			<main className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
				<div className="space-y-8">
					{/* Header Section */}
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
						<div>
							<h1 className="text-4xl font-extrabold tracking-tight">
								Manage Users
							</h1>
							<p className="mt-2 text-gray-400">
								View and manage user roles, permissions, and status.
							</p>
						</div>

						<div className="relative w-full md:w-96">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<MagnifyingGlass className="h-5 w-5 text-gray-500" />
							</div>
							<input
								type="text"
								className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
								placeholder="Search by name or email..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
					</div>

					{/* Stats Summary */}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
							<div className="flex items-center gap-4">
								<div className="p-3 bg-indigo-500/10 rounded-xl">
									<Users className="w-6 h-6 text-indigo-500" />
								</div>
								<div>
									<div className="text-sm text-gray-400">Total Users</div>
									<div className="text-2xl font-bold">{users.length}</div>
								</div>
							</div>
						</div>
						<div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
							<div className="flex items-center gap-4">
								<div className="p-3 bg-purple-500/10 rounded-xl">
									<Crown className="w-6 h-6 text-purple-500" />
								</div>
								<div>
									<div className="text-sm text-gray-400">Gnar Dawgs</div>
									<div className="text-2xl font-bold">
										{users.filter((u) => u.role === "gnar-dawg").length}
									</div>
								</div>
							</div>
						</div>
						<div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
							<div className="flex items-center gap-4">
								<div className="p-3 bg-green-500/10 rounded-xl">
									<CheckCircle className="w-6 h-6 text-green-500" />
								</div>
								<div>
									<div className="text-sm text-gray-400">Active</div>
									<div className="text-2xl font-bold">
										{users.filter((u) => !u.banned).length}
									</div>
								</div>
							</div>
						</div>
						<div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
							<div className="flex items-center gap-4">
								<div className="p-3 bg-red-500/10 rounded-xl">
									<Prohibit className="w-6 h-6 text-red-500" />
								</div>
								<div>
									<div className="text-sm text-gray-400">Banned</div>
									<div className="text-2xl font-bold">
										{users.filter((u) => u.banned).length}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Main Table */}
					<div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-white/10">
								<thead className="bg-[#111]">
									<tr>
										<th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
											User
										</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
											Role
										</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
											Status
										</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
											Joined
										</th>
										<th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/5">
									{filteredUsers.length === 0 ? (
										<tr>
											<td
												colSpan={5}
												className="px-6 py-12 text-center text-gray-500"
											>
												<div className="flex flex-col items-center gap-2">
													<Users className="w-12 h-12 opacity-20" />
													<p>No users found matching your search</p>
												</div>
											</td>
										</tr>
									) : (
										filteredUsers.map((user) => (
											<tr
												key={user.id}
												className="hover:bg-white/5 transition-colors group"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center">
														<div className="h-10 w-10 flex-shrink-0">
															{user.image ? (
																<img
																	className="h-10 w-10 rounded-full border border-white/10 object-cover"
																	src={user.image}
																	alt=""
																/>
															) : (
																<div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
																	<UserCircle
																		weight="fill"
																		className="w-8 h-8 text-indigo-500/60"
																	/>
																</div>
															)}
														</div>
														<div className="ml-4">
															<div className="text-sm font-semibold text-white">
																{user.name || "No Name"}
															</div>
															<div className="text-sm text-gray-500">
																{user.email}
															</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<select
														value={user.role || "user"}
														onChange={(e) =>
															handleRoleChange(user.id, e.target.value)
														}
														className="bg-black/50 border border-white/10 text-sm rounded-lg px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500 block w-32 transition-all hover:border-white/20"
													>
														<option value="user">User</option>
														<option value="admin">Admin</option>
														<option value="gnar-dawg">Gnar Dawg</option>
													</select>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													{user.banned ? (
														<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
															<Prohibit size={14} /> Banned
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
															<CheckCircle size={14} /> Active
														</span>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
													{new Date(user.createdAt).toLocaleDateString()}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
													<div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
														<button
															type="button"
															onClick={() =>
																handleBanToggle(user.id, !!user.banned)
															}
															className={`p-2 rounded-lg transition-colors ${user.banned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"}`}
															title={user.banned ? "Unban User" : "Ban User"}
														>
															{user.banned ? (
																<CheckCircle size={20} />
															) : (
																<Prohibit size={20} />
															)}
														</button>
														<Form
															method="post"
															className="inline"
															onSubmit={(e) => {
																if (
																	!confirm(
																		"Are you sure you want to delete this user?",
																	)
																)
																	e.preventDefault();
															}}
														>
															<input
																type="hidden"
																name="userId"
																value={user.id}
															/>
															<button
																type="submit"
																name="intent"
																value="delete"
																className="p-2 bg-gray-500/10 text-gray-400 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
																title="Delete User"
															>
																<Trash size={20} />
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
			</main>

			<footer className="mt-auto py-8 border-t border-white/5 bg-black/20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-gray-600">
					<div>&copy; 2025 Gnar Dawgs Inc.</div>
					<div className="flex gap-6">
						<Link to="/" className="hover:text-gray-400 transition-colors">
							Support
						</Link>
						<Link to="/" className="hover:text-gray-400 transition-colors">
							Privacy
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}

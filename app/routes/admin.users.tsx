import {
	CheckCircle,
	Crown,
	MagnifyingGlass,
	Prohibit,
	Trash,
	UserCircle,
	Users,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";

type AdminUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	banned?: boolean;
	image?: string;
	createdAt: string | Date;
	whatsappNumber?: string;
};

export default function AdminUsers() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	// Check auth and admin status
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}
	}, [session, sessionLoading, navigate]);

	// Fetch users
	useEffect(() => {
		if (!session?.user) return;

		const fetchUsers = async () => {
			try {
				setLoading(true);
				const { data } = await authClient.admin.listUsers({
					query: {
						limit: 100,
					},
				});
				if (data?.users) {
					setUsers(data.users as AdminUser[]);
				}
			} catch (error) {
				console.error("Failed to fetch users:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, [session]);

	const filteredUsers = users.filter(
		(u) =>
			u.email?.toLowerCase().includes(search.toLowerCase()) ||
			u.name?.toLowerCase().includes(search.toLowerCase()),
	);

	const handleRoleChange = async (userId: string, role: string) => {
		try {
			await authClient.admin.setRole({
				userId,
				// @ts-expect-error - better-auth API accepts any string role, but types are strict
				role,
			});
			// Refresh users
			const { data } = await authClient.admin.listUsers({
				query: { limit: 100 },
			});
			if (data?.users) {
				setUsers(data.users as AdminUser[]);
			}
		} catch (error) {
			console.error("Failed to update role:", error);
		}
	};

	const handleBanToggle = async (userId: string, isBanned: boolean) => {
		try {
			if (isBanned) {
				await authClient.admin.unbanUser({ userId });
			} else {
				await authClient.admin.banUser({ userId });
			}
			// Refresh users
			const { data } = await authClient.admin.listUsers({
				query: { limit: 100 },
			});
			if (data?.users) {
				setUsers(data.users as AdminUser[]);
			}
		} catch (error) {
			console.error("Failed to toggle ban:", error);
		}
	};

	const handleDelete = async (userId: string) => {
		if (!confirm("Are you sure you want to delete this user?")) {
			return;
		}

		try {
			await authClient.admin.removeUser({ userId });
			// Refresh users
			const { data } = await authClient.admin.listUsers({
				query: { limit: 100 },
			});
			if (data?.users) {
				setUsers(data.users as AdminUser[]);
			}
		} catch (error) {
			console.error("Failed to delete user:", error);
		}
	};

	const handleWhatsAppUpdate = async (
		userId: string,
		whatsappNumber: string,
	) => {
		// Validate format: + followed by digits
		if (whatsappNumber && !/^\+[1-9]\d{1,14}$/.test(whatsappNumber)) {
			alert(
				"Invalid WhatsApp number format. Must be in format +1234567890 (e.g., +16198064334)",
			);
			return;
		}

		try {
			const formData = new FormData();
			formData.append("userId", userId);
			formData.append("whatsappNumber", whatsappNumber || "");

			const { data: updatedUserResults, error: updateUserError } =
				await authClient.admin.updateUser({
					userId,
					data: { whatsappNumber },
				});

			if (updateUserError) {
				throw new Error(updateUserError.message);
			}

			// Refresh users
			const { data } = await authClient.admin.listUsers({
				query: { limit: 100 },
			});
			if (data?.users) {
				setUsers(data.users as AdminUser[]);
			}
		} catch (error) {
			console.error("Failed to update WhatsApp number:", error);
			alert(
				error instanceof Error
					? error.message
					: "Failed to update WhatsApp number",
			);
		}
	};

	if (sessionLoading || loading) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="text-gray-400">Loading users...</div>
			</div>
		);
	}

	return (
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
									WhatsApp
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
										colSpan={6}
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
												<div className="h-10 w-10 shrink-0">
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
											<input
												type="text"
												value={user.whatsappNumber || ""}
												onChange={(e) => {
													// Update local state immediately for better UX
													setUsers((prev) =>
														prev.map((u) =>
															u.id === user.id
																? { ...u, whatsappNumber: e.target.value }
																: u,
														),
													);
												}}
												onBlur={(e) => {
													handleWhatsAppUpdate(user.id, e.target.value);
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.currentTarget.blur();
													}
												}}
												placeholder="+16198064334"
												className="bg-black/50 border border-white/10 text-sm rounded-lg px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500 block w-40 transition-all hover:border-white/20"
											/>
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
												<button
													type="button"
													onClick={() => handleDelete(user.id)}
													className="p-2 bg-gray-500/10 text-gray-400 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
													title="Delete User"
												>
													<Trash size={20} />
												</button>
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

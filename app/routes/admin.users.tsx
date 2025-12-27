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
import { authClient } from "~/app/lib/auth-client";
import { Badge } from "~/app/components/ui/badge";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Input } from "~/app/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/app/components/ui/select";
import { Skeleton } from "~/app/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/app/components/ui/table";

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
			<div className="space-y-8">
				<div>
					<Skeleton className="h-10 w-48 mb-2" />
					<Skeleton className="h-5 w-64" />
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24" />
					))}
				</div>
				<Skeleton className="h-96" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight">
						Manage Users
					</h1>
					<p className="mt-2 text-muted-foreground">
						View and manage user roles, permissions, and status.
					</p>
				</div>

				<div className="relative w-full md:w-96">
					<MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
					<Input
						type="text"
						className="pl-10"
						placeholder="Search by name or email..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-4">
							<div className="p-3 bg-primary/10 rounded-xl">
								<Users className="w-6 h-6 text-primary" />
							</div>
							<div>
								<CardDescription>Total Users</CardDescription>
								<CardTitle className="text-2xl">{users.length}</CardTitle>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-4">
							<div className="p-3 bg-primary/10 rounded-xl">
								<Crown className="w-6 h-6 text-primary" />
							</div>
							<div>
								<CardDescription>Gnar Dawgs</CardDescription>
								<CardTitle className="text-2xl">
									{users.filter((u) => u.role === "gnar-dawg").length}
								</CardTitle>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-4">
							<div className="p-3 bg-primary/10 rounded-xl">
								<CheckCircle className="w-6 h-6 text-primary" />
							</div>
							<div>
								<CardDescription>Active</CardDescription>
								<CardTitle className="text-2xl">
									{users.filter((u) => !u.banned).length}
								</CardTitle>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-4">
							<div className="p-3 bg-destructive/10 rounded-xl">
								<Prohibit className="w-6 h-6 text-destructive" />
							</div>
							<div>
								<CardDescription>Banned</CardDescription>
								<CardTitle className="text-2xl">
									{users.filter((u) => u.banned).length}
								</CardTitle>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card className="py-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>WhatsApp</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredUsers.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center py-12">
									<div className="flex flex-col items-center gap-2">
										<Users className="w-12 h-12 opacity-20 text-muted-foreground" />
										<p className="text-muted-foreground">
											No users found matching your search
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							filteredUsers.map((user) => (
								<TableRow key={user.id} className="group">
									<TableCell>
										<div className="flex items-center gap-4">
											<div className="h-10 w-10 shrink-0">
												{user.image ? (
													<img
														className="h-10 w-10 rounded-full border object-cover"
														src={user.image}
														alt=""
													/>
												) : (
													<div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
														<UserCircle
															weight="fill"
															className="w-8 h-8 text-primary/60"
														/>
													</div>
												)}
											</div>
											<div>
												<div className="text-sm font-semibold">
													{user.name || "No Name"}
												</div>
												<div className="text-sm text-muted-foreground">
													{user.email}
												</div>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Select
											value={user.role || "user"}
											onValueChange={(value) =>
												handleRoleChange(user.id, value)
											}
										>
											<SelectTrigger className="w-32">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="user">User</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
												<SelectItem value="gnar-dawg">Gnar Dawg</SelectItem>
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										<Input
											type="text"
											value={user.whatsappNumber || ""}
											onChange={(e) => {
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
											className="w-40"
										/>
									</TableCell>
									<TableCell>
										{user.banned ? (
											<Badge variant="destructive" className="gap-1.5">
												<Prohibit size={14} /> Banned
											</Badge>
										) : (
											<Badge variant="outline" className="gap-1.5">
												<CheckCircle size={14} /> Active
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(user.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleBanToggle(user.id, !!user.banned)}
												title={user.banned ? "Unban User" : "Ban User"}
												className={
													user.banned
														? "text-primary hover:text-primary"
														: "text-destructive hover:text-destructive"
												}
											>
												{user.banned ? (
													<CheckCircle size={20} />
												) : (
													<Prohibit size={20} />
												)}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleDelete(user.id)}
												title="Delete User"
												className="text-destructive hover:text-destructive"
											>
												<Trash size={20} />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}

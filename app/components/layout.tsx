import { Shield, User } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router";
import { ADMIN_USER_IDS } from "~/app/config/constants";
import { authClient } from "~/app/lib/auth-client";
import { Button } from "./ui/button";

type SessionUser = {
	id: string;
	email: string;
	name: string;
	role?: string;
	image?: string;
};

export function Layout({ children }: { children: React.ReactNode }) {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();

	const currentUser = session?.user as unknown as SessionUser | undefined;
	const isAdmin =
		currentUser &&
		(currentUser.role === "admin" || ADMIN_USER_IDS.includes(currentUser.id));

	if (sessionLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-between items-center">
						<div className="flex items-center gap-2">
							<Link to="/" className="flex items-center gap-2">
								{isAdmin ? (
									<Shield className="w-8 h-8 text-primary" weight="fill" />
								) : (
									<User className="w-8 h-8 text-primary" weight="fill" />
								)}
								<span className="text-xl font-bold">
									{isAdmin ? "Gnar Dawgs Admin" : "Gnar Dawgs"}
								</span>
							</Link>
						</div>
						<div className="flex items-center gap-6">
							{currentUser ? (
								<>
									<div className="text-sm font-medium text-muted-foreground">
										<span className="hidden sm:inline">
											{isAdmin ? "Admin: " : ""}
										</span>
										{currentUser.email}
									</div>
									<Link
										to="/charter"
										className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
									>
										Charter
									</Link>
									<Link
										to="/profile"
										className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
									>
										Profile
									</Link>
									{isAdmin && (
										<Link
											to="/admin"
											className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
										>
											Admin
										</Link>
									)}
									{/* <Link
										to="/chat"
										className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
									>
										Chat
									</Link> */}
									<Button
										variant={"ghost"}
										onClick={async () => {
											await authClient.signOut();
											navigate("/login");
										}}
										className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
									>
										Sign Out
									</Button>
								</>
							) : (
								<Link
									to="/login"
									className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
								>
									Login
								</Link>
							)}
						</div>
					</div>
				</div>
			</nav>

			<main className="py-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
				{children}
			</main>

			<footer className="mt-auto py-8 border-t border-border bg-muted/20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-muted-foreground">
					<div>&copy; 2025 Gnar Dawgs Inc.</div>
					<div className="flex gap-6">
						<Link to="/" className="hover:text-foreground transition-colors">
							Support
						</Link>
						<Link to="/" className="hover:text-foreground transition-colors">
							Privacy
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}

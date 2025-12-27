import { Link } from "react-router";
import { authClient } from "~/app/lib/auth-client";

export default function Login() {
	const handleGoogleSignIn = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: "/", // Redirect to home on success
		});
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
			<div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
				<div className="text-center">
					<h2 className="text-3xl font-bold tracking-tight text-gray-900">
						Sign in to Gnar Dawgs
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						Invite-only community access
					</p>
				</div>

				<div className="mt-8 space-y-6">
					<button
						type="button"
						onClick={handleGoogleSignIn}
						className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0"
					>
						<svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
							<path
								d="M12.0003 20.45c4.6669 0 8.1691-3.242 8.1691-8.172 0-.693-.0615-1.393-.1982-2.072H12.0003v3.911h4.7472c-.2204 1.258-1.5714 3.655-4.7472 3.655-2.8682 0-5.2107-2.347-5.2107-5.244 0-2.897 2.3425-5.244 5.2107-5.244 1.55 0 2.9231.579 3.9961 1.631l2.946-2.946C17.0621 3.42 14.7303 2.5 12.0003 2.5c-5.246 0-9.5 4.254-9.5 9.5 0 5.246 4.254 9.5 9.5 9.5z"
								fill="currentColor"
							/>
						</svg>
						Sign in with Google
					</button>

					<div className="relative">
						<div
							className="absolute inset-0 flex items-center"
							aria-hidden="true"
						>
							<div className="w-full border-t border-gray-200" />
						</div>
						<div className="relative flex justify-center text-sm font-medium leading-6">
							<span className="bg-white px-6 text-gray-900">Or</span>
						</div>
					</div>

					<div className="text-center">
						<Link
							to="/request-access"
							className="font-semibold text-indigo-600 hover:text-indigo-500"
						>
							Request Access
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

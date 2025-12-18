import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/request-access";

export const action = async ({ request, context }: Route.ActionArgs) => {
	const formData = await request.formData();
	const email = formData.get("email") as string;
	const reason = formData.get("reason") as string;

	if (!email) {
		return { error: "Email is required" };
	}

	const db = context.cloudflare.env.DB;
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	try {
		await db
			.prepare(
				"INSERT INTO access_requests (id, email, reason, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
			)
			.bind(id, email, reason, createdAt)
			.run();
		return { success: true };
	} catch (e) {
		console.error(e);
		return {
			error: "Failed to submit request. Email might already be pending.",
		};
	}
};

export default function RequestAccess() {
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	if (actionData?.success) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
				<div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
					<h2 className="text-2xl font-bold text-green-600">
						Request Received!
					</h2>
					<p className="mt-4 text-gray-600">
						We have received your request. You will be notified via email once
						approved.
					</p>
					<a
						href="/"
						className="mt-6 inline-block text-indigo-600 hover:text-indigo-500"
					>
						Back to Home
					</a>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
			<div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
				<div className="text-center">
					<h2 className="text-3xl font-bold tracking-tight text-gray-900">
						Request Access
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						Tell us why you want to join Gnar Dawgs
					</p>
				</div>

				<Form method="post" className="space-y-6">
					<div>
						<label
							htmlFor="email"
							className="block text-sm font-medium leading-6 text-gray-900"
						>
							Email address
						</label>
						<div className="mt-2">
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
							/>
						</div>
					</div>

					<div>
						<label
							htmlFor="reason"
							className="block text-sm font-medium leading-6 text-gray-900"
						>
							Why should we let you in?
						</label>
						<div className="mt-2">
							<textarea
								id="reason"
								name="reason"
								rows={3}
								className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
							/>
						</div>
					</div>

					{actionData?.error && (
						<div className="text-red-500 text-sm">{actionData.error}</div>
					)}

					<div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
						>
							{isSubmitting ? "Submitting..." : "Submit Request"}
						</button>
					</div>
				</Form>
				<div className="text-center">
					<a
						href="/login"
						className="text-sm text-gray-600 hover:text-gray-500"
					>
						Back to Login
					</a>
				</div>
			</div>
		</div>
	);
}

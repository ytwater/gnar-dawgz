import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth-client";
import { orpcClient } from "~/lib/orpc/client";
import {
	getCurrentPushSubscription,
	getNotificationPermissionStatus,
	isPushNotificationSupported,
	subscribeToPushNotifications,
	unsubscribeFromPushNotifications,
} from "~/lib/push-notifications";
import type { Route } from "./+types/profile";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Profile - Gnar Dawgs" },
		{
			name: "description",
			content: "Manage your profile and notification settings",
		},
	];
}

export default function Profile() {
	const session = authClient.useSession();
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isSendingTest, setIsSendingTest] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [pushSupported, setPushSupported] = useState(true);

	// Check if notifications are already enabled on mount
	useEffect(() => {
		async function checkNotificationStatus() {
			if (!isPushNotificationSupported()) {
				setPushSupported(false);
				return;
			}

			const permission = getNotificationPermissionStatus();
			if (permission === "granted") {
				const subscription = await getCurrentPushSubscription();
				setNotificationsEnabled(!!subscription);
			}
		}

		checkNotificationStatus();
	}, []);

	const handleNotificationToggle = async (enabled: boolean) => {
		setIsLoading(true);
		setError(null);
		setSuccess(null);

		try {
			if (enabled) {
				// Get VAPID public key from the server
				const { publicKey } = await orpcClient.push.vapidKey();

				// Subscribe to push notifications
				const subscription = await subscribeToPushNotifications(publicKey);

				if (!subscription.keys.p256dh || !subscription.keys.auth) {
					throw new Error("Invalid subscription keys");
				}

				// Save subscription to the server
				await orpcClient.push.subscribe({
					endpoint: subscription.endpoint,
					keys: {
						p256dh: subscription.keys.p256dh,
						auth: subscription.keys.auth,
					},
				});

				setNotificationsEnabled(true);
				setSuccess("Notifications enabled successfully!");
			} else {
				// Unsubscribe from push notifications
				await unsubscribeFromPushNotifications();

				// Remove subscription from the server
				await orpcClient.push.unsubscribe();

				setNotificationsEnabled(false);
				setSuccess("Notifications disabled successfully!");
			}
		} catch (err) {
			console.error("Error toggling notifications:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to update notification settings",
			);
			// Revert the toggle state
			setNotificationsEnabled(!enabled);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSendTestNotification = async () => {
		setIsSendingTest(true);
		setError(null);
		setSuccess(null);

		try {
			// Verify subscription matches browser's actual subscription
			const browserSubscription = await getCurrentPushSubscription();
			if (!browserSubscription) {
				throw new Error(
					"No active push subscription found in browser. Please re-enable notifications.",
				);
			}

			// Get current VAPID key
			const { publicKey: currentVapidKey } = await orpcClient.push.vapidKey();

			console.log(
				"Browser subscription endpoint:",
				browserSubscription.endpoint,
			);
			console.log("Browser subscription keys:", {
				p256dh: browserSubscription.keys.p256dh
					? `${browserSubscription.keys.p256dh.substring(0, 20)}...`
					: undefined,
				auth: browserSubscription.keys.auth
					? `${browserSubscription.keys.auth.substring(0, 10)}...`
					: undefined,
			});
			console.log("Current VAPID public key:", currentVapidKey);

			// Verify the stored subscription matches the browser's subscription
			// This helps catch cases where the database has an old subscription
			const stored = await orpcClient.push.subscriptionCheck();
			if (stored.endpoint && stored.endpoint !== browserSubscription.endpoint) {
				console.warn("⚠️ Subscription mismatch detected!");
				console.warn("Stored endpoint:", stored.endpoint);
				console.warn("Browser endpoint:", browserSubscription.endpoint);
				console.warn("Updating stored subscription to match browser...");

				// Auto-sync: update the stored subscription to match the browser
				if (
					!browserSubscription.keys.p256dh ||
					!browserSubscription.keys.auth
				) {
					throw new Error("Invalid browser subscription keys");
				}

				await orpcClient.push.subscribe({
					endpoint: browserSubscription.endpoint,
					keys: {
						p256dh: browserSubscription.keys.p256dh,
						auth: browserSubscription.keys.auth,
					},
				});

				console.log("✅ Subscription synced successfully");
			}

			await orpcClient.push.test();

			setSuccess("Test notification sent! Check your notifications.");

			// Verify service worker is active and can receive push events
			setTimeout(async () => {
				try {
					const registration = await navigator.serviceWorker.getRegistration();
					if (registration) {
						console.log("Service Worker registration:", {
							active: !!registration.active,
							installing: !!registration.installing,
							waiting: !!registration.waiting,
							scope: registration.scope,
						});

						const subscription =
							await registration.pushManager.getSubscription();
						if (subscription) {
							console.log("Push subscription is active:", {
								endpoint: subscription.endpoint,
								expirationTime: subscription.expirationTime,
							});
						} else {
							console.warn("⚠️ No active push subscription found!");
						}
					} else {
						console.warn("⚠️ No service worker registration found!");
					}
				} catch (err) {
					console.error("Error checking service worker:", err);
				}

				console.log(
					"If you don't see a notification, check the Service Worker console (DevTools > Application > Service Workers) for push event logs.",
				);
			}, 1000);
		} catch (err) {
			console.error("Error sending test notification:", err);
			setError(
				err instanceof Error ? err.message : "Failed to send test notification",
			);
		} finally {
			setIsSendingTest(false);
		}
	};

	if (!session.data?.user) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
				<div className="text-white text-xl">
					Please log in to view your profile.
				</div>
			</div>
		);
	}

	const user = session.data.user;

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				{/* Header */}
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-white mb-2">Profile</h1>
					<p className="text-purple-200">
						Manage your account and notification settings
					</p>
				</div>

				{/* User Information Card */}
				<div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
					<h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-label="User icon"
							role="img"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						User Information
					</h2>

					<div className="space-y-4">
						<div className="flex items-center gap-4">
							{user.image && (
								<img
									src={user.image}
									alt={user.name}
									className="w-16 h-16 rounded-full border-2 border-purple-400"
								/>
							)}
							<div>
								<p className="text-sm text-purple-200">Name</p>
								<p className="text-lg font-medium text-white">{user.name}</p>
							</div>
						</div>

						<div>
							<p className="text-sm text-purple-200">Email</p>
							<p className="text-lg font-medium text-white">{user.email}</p>
						</div>

						{user.role && (
							<div>
								<p className="text-sm text-purple-200">Role</p>
								<p className="text-lg font-medium text-white capitalize">
									{user.role}
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Notification Settings Card */}
				<div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
					<h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-label="Notification icon"
							role="img"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
							/>
						</svg>
						Notification Settings
					</h2>

					{!pushSupported && (
						<div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
							<p className="text-yellow-200 text-sm">
								Push notifications are not supported in your browser.
							</p>
						</div>
					)}

					{error && (
						<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
							<p className="text-red-200 text-sm">{error}</p>
						</div>
					)}

					{success && (
						<div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
							<p className="text-green-200 text-sm">{success}</p>
						</div>
					)}

					<div className="space-y-6">
						{/* Notification Toggle */}
						<div className="flex items-center justify-between">
							<div>
								<p className="text-lg font-medium text-white">
									Browser Notifications
								</p>
								<p className="text-sm text-purple-200">
									Receive push notifications in your browser
								</p>
							</div>
							<button
								type="button"
								disabled={isLoading || !pushSupported}
								onClick={() => handleNotificationToggle(!notificationsEnabled)}
								className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
									notificationsEnabled ? "bg-purple-600" : "bg-gray-600"
								}`}
							>
								<span
									className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
										notificationsEnabled ? "translate-x-7" : "translate-x-1"
									}`}
								/>
							</button>
						</div>

						{/* Test Notification Button */}
						{notificationsEnabled && (
							<div className="pt-4 border-t border-white/10">
								<button
									type="button"
									disabled={isSendingTest}
									onClick={handleSendTestNotification}
									className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
								>
									{isSendingTest ? (
										<>
											<svg
												className="animate-spin h-5 w-5"
												fill="none"
												viewBox="0 0 24 24"
												aria-label="Loading spinner"
												role="img"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												/>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												/>
											</svg>
											Sending...
										</>
									) : (
										<>
											<svg
												className="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-label="Send icon"
												role="img"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
												/>
											</svg>
											Send Test Notification
										</>
									)}
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

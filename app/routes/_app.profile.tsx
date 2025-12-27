import { Bell, PaperPlaneTilt, User } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Layout } from "~/app/components/layout";
import { Alert, AlertDescription } from "~/app/components/ui/alert";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "~/app/components/ui/avatar";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Skeleton } from "~/app/components/ui/skeleton";
import { Switch } from "~/app/components/ui/switch";
import { authClient } from "~/app/lib/auth-client";
import { orpcClient } from "~/app/lib/orpc/client";
import {
	getCurrentPushSubscription,
	getNotificationPermissionStatus,
	isPushNotificationSupported,
	subscribeToPushNotifications,
	unsubscribeFromPushNotifications,
} from "~/app/lib/push-notifications";
import type { Route } from "./+types/_app.profile";

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

	if (session.isPending) {
		return (
			<div className="space-y-8">
				<div>
					<Skeleton className="h-10 w-48 mb-2" />
					<Skeleton className="h-5 w-64" />
				</div>
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	if (!session.data?.user) {
		return (
			<div className="flex items-center justify-center p-12">
				<p className="text-muted-foreground text-xl">
					Please log in to view your profile.
				</p>
			</div>
		);
	}

	const user = session.data.user;

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-4xl font-extrabold tracking-tight">Profile</h1>
				<p className="mt-2 text-muted-foreground">
					Manage your account and notification settings
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<User className="w-6 h-6" />
						User Information
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-center gap-4">
						<Avatar className="w-16 h-16">
							{user.image && <AvatarImage src={user.image} alt={user.name} />}
							<AvatarFallback>
								{user.name
									?.split(" ")
									.map((n) => n[0])
									.join("")
									.toUpperCase() || "U"}
							</AvatarFallback>
						</Avatar>
						<div>
							<CardDescription>Name</CardDescription>
							<CardTitle className="text-lg">{user.name}</CardTitle>
						</div>
					</div>

					<div>
						<CardDescription>Email</CardDescription>
						<p className="text-lg font-medium">{user.email}</p>
					</div>

					{user.role && (
						<div>
							<CardDescription>Role</CardDescription>
							<p className="text-lg font-medium capitalize">{user.role}</p>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bell className="w-6 h-6" />
						Notification Settings
					</CardTitle>
					<CardDescription>
						Manage your browser push notification preferences
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{!pushSupported && (
						<Alert variant="default">
							<AlertDescription>
								Push notifications are not supported in your browser.
							</AlertDescription>
						</Alert>
					)}

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{success && (
						<Alert variant="default">
							<AlertDescription>{success}</AlertDescription>
						</Alert>
					)}

					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-lg">Browser Notifications</CardTitle>
							<CardDescription>
								Receive push notifications in your browser
							</CardDescription>
						</div>
						<Switch
							checked={notificationsEnabled}
							disabled={isLoading || !pushSupported}
							onCheckedChange={handleNotificationToggle}
						/>
					</div>

					{notificationsEnabled && (
						<div className="pt-4 border-t">
							<Button
								type="button"
								disabled={isSendingTest}
								onClick={handleSendTestNotification}
								className="w-full"
							>
								{isSendingTest ? (
									<>
										<div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
										Sending...
									</>
								) : (
									<>
										<PaperPlaneTilt className="w-5 h-5" />
										Send Test Notification
									</>
								)}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

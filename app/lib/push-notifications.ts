/**
 * Utility functions for managing browser push notifications
 */

export interface PushSubscriptionData {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
}

/**
 * Check if push notifications are supported in the current browser
 */
export function isPushNotificationSupported(): boolean {
	return (
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission {
	if (!isPushNotificationSupported()) {
		return "denied";
	}
	return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (!isPushNotificationSupported()) {
		throw new Error("Push notifications are not supported in this browser");
	}

	const permission = await Notification.requestPermission();
	return permission;
}

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Subscribe the user to push notifications
 */
export async function subscribeToPushNotifications(
	vapidPublicKey: string,
): Promise<PushSubscriptionData> {
	if (!isPushNotificationSupported()) {
		throw new Error("Push notifications are not supported in this browser");
	}

	// Request permission if not already granted
	const permission = await requestNotificationPermission();
	if (permission !== "granted") {
		throw new Error("Notification permission denied");
	}

	// Register service worker if not already registered
	let registration = await navigator.serviceWorker.getRegistration();
	if (!registration) {
		registration = await navigator.serviceWorker.register("/service-worker.js");
		await navigator.serviceWorker.ready;
	}

	// Subscribe to push notifications
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
	});

	// Convert subscription to JSON format
	const subscriptionJson = subscription.toJSON();

	if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
		throw new Error("Invalid subscription data");
	}

	return {
		endpoint: subscriptionJson.endpoint,
		keys: {
			p256dh: subscriptionJson.keys.p256dh,
			auth: subscriptionJson.keys.auth,
		},
	};
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
	if (!isPushNotificationSupported()) {
		return;
	}

	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration) {
		return;
	}

	const subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		await subscription.unsubscribe();
	}
}

/**
 * Get the current push subscription if it exists
 */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionData | null> {
	if (!isPushNotificationSupported()) {
		return null;
	}

	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration) {
		return null;
	}

	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		return null;
	}

	const subscriptionJson = subscription.toJSON();
	if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
		return null;
	}

	return {
		endpoint: subscriptionJson.endpoint,
		keys: {
			p256dh: subscriptionJson.keys.p256dh,
			auth: subscriptionJson.keys.auth,
		},
	};
}

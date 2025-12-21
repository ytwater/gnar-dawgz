// Log that service worker is loaded
console.log("[Service Worker] Script loaded and executing");

// Handle push notification events
self.addEventListener("push", (event) => {
	console.log("[Service Worker] ===== PUSH EVENT RECEIVED =====");
	console.log("[Service Worker] Event details:", {
		hasData: !!event.data,
		dataType: event.data?.type,
		timestamp: new Date().toISOString(),
	});

	// Always show a notification, even if there's no data
	let notificationData = {
		title: "Gnar Dawgs",
		body: "You have a new notification",
	};

	if (event.data) {
		try {
			notificationData = event.data.json();
			console.log(
				"[Service Worker] Successfully parsed JSON:",
				notificationData,
			);
		} catch (error) {
			console.error("[Service Worker] Failed to parse JSON:", error);
			// Try to get text instead
			try {
				const text = event.data.text();
				console.log("[Service Worker] Got text data:", text);
				notificationData = {
					title: "Gnar Dawgs",
					body: text || "You have a new notification",
				};
			} catch (textError) {
				console.error("[Service Worker] Failed to get text:", textError);
			}
		}
	} else {
		console.warn(
			"[Service Worker] Push event has no data, using default notification",
		);
	}

	const {
		title = "Gnar Dawgs",
		body = "New notification",
		icon,
		badge,
		data,
	} = notificationData;

	const options = {
		body,
		icon: icon || "/icon-192.png",
		badge: badge || "/icon-192.png",
		data: data || {},
		vibrate: [200, 100, 200],
		tag: "gnar-dawgs-notification",
		requireInteraction: false,
		silent: false,
	};

	console.log("[Service Worker] Attempting to show notification:", {
		title,
		options,
	});

	event.waitUntil(
		self.registration
			.showNotification(title, options)
			.then(() => {
				console.log("[Service Worker] ✅ Notification shown successfully!");
			})
			.catch((error) => {
				console.error(
					"[Service Worker] ❌ Failed to show notification:",
					error,
				);
				// Try to show a basic notification as fallback
				return self.registration.showNotification("Gnar Dawgs", {
					body: "New notification (fallback)",
				});
			}),
	);
});

// Handle notification click events
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				// If a window is already open, focus it
				for (const client of clientList) {
					if ("focus" in client) {
						return client.focus();
					}
				}
				// Otherwise, open a new window
				if (self.clients.openWindow) {
					return self.clients.openWindow("/");
				}
			}),
	);
});

// Install event - cache static assets if needed
self.addEventListener("install", (event) => {
	console.log("[Service Worker] Installing...");
	// Skip waiting to activate immediately
	self.skipWaiting();
});

// Activate event - clean up old caches if needed
self.addEventListener("activate", (event) => {
	console.log("[Service Worker] Activating...");
	// Don't claim clients immediately - let pages load naturally
	// This prevents interference with React Router hydration
	event.waitUntil(
		Promise.resolve().then(() => {
			console.log("[Service Worker] Activated");
		}),
	);
});

// Fetch event - pass through all requests to network
// This ensures React Router and other scripts load normally
self.addEventListener("fetch", (event) => {
	// Always fetch from network, don't cache or intercept
	event.respondWith(fetch(event.request));
});

// Handle messages from the page
self.addEventListener("message", (event) => {
	console.log("[Service Worker] Message received:", event.data);

	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

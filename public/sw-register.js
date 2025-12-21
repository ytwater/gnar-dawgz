/**
 * Service Worker registration and update handler
 * This script ensures the service worker is always up to date
 */

if ("serviceWorker" in navigator) {
	// Register or update the service worker
	navigator.serviceWorker
		.register("/service-worker.js")
		.then((registration) => {
			console.log("[SW Registration] Service Worker registered:", registration);

			// Check for updates immediately
			registration.update();

			// Check for updates every 60 seconds
			setInterval(() => {
				registration.update();
			}, 60000);

			// Listen for updates
			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				console.log(
					"[SW Registration] New service worker found, installing...",
				);

				if (newWorker) {
					newWorker.addEventListener("statechange", () => {
						console.log(
							"[SW Registration] Service worker state changed:",
							newWorker.state,
						);

						if (
							newWorker.state === "installed" &&
							navigator.serviceWorker.controller
						) {
							// New service worker available, prompt user to refresh
							console.log(
								"[SW Registration] New service worker installed. Refresh the page to use it.",
							);

							// Automatically skip waiting and activate the new service worker
							newWorker.postMessage({ type: "SKIP_WAITING" });
						}
					});
				}
			});
		})
		.catch((error) => {
			console.error(
				"[SW Registration] Service Worker registration failed:",
				error,
			);
		});

	// Handle service worker controller change (when new SW activates)
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		console.log(
			"[SW Registration] Service worker controller changed, reloading page...",
		);
		window.location.reload();
	});
}

import { CheckCircle, Plus, Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";

type Subscription = {
	sid: string | null;
	description: string | null;
	sink_sid: string | null;
	date_created: string | null;
	date_updated: string | null;
};

type SubscribedEvent = {
	type: string;
	schema_version: number | null;
	date_created: string | null;
	date_updated: string | null;
};

export default function AdminTwilioEventSync() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();
	const [subscription, setSubscription] = useState<Subscription | null>(null);
	const [subscribedEvents, setSubscribedEvents] = useState<SubscribedEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [eventType, setEventType] = useState("");
	const [schemaVersion, setSchemaVersion] = useState<number | undefined>(undefined);
	const [isAdding, setIsAdding] = useState(false);
	const [description, setDescription] = useState("");
	const [isUpdating, setIsUpdating] = useState(false);

	// Check auth
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}
	}, [session, sessionLoading, navigate]);

	// Fetch subscription and events
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch("/api/twilio/event-sync");
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch event sync");
			}

			setSubscription(data.subscription || null);
			setSubscribedEvents(data.subscribedEvents || []);
			setDescription(data.subscription?.description || "");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch event sync",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!session?.user) return;
		fetchData();
	}, [session, fetchData]);

	const handleUpdateDescription = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsUpdating(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/twilio/event-sync", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					action: "updateSubscription",
					description,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to update subscription");
			}

			setSuccess("Subscription updated successfully");
			setSubscription(data.subscription || subscription);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to update subscription",
			);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleAddEvent = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAdding(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/twilio/event-sync", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					action: "addEvent",
					eventType,
					schemaVersion,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to add event");
			}

			setSuccess("Event subscribed successfully");
			setEventType("");
			setSchemaVersion(undefined);
			setShowAddForm(false);
			await fetchData();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to add event",
			);
		} finally {
			setIsAdding(false);
		}
	};

	const handleRemoveEvent = async (eventType: string) => {
		if (!confirm(`Are you sure you want to unsubscribe from ${eventType}?`)) {
			return;
		}

		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/twilio/event-sync", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ eventType }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to remove event");
			}

			setSuccess("Event unsubscribed successfully");
			await fetchData();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to remove event",
			);
		}
	};

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "N/A";
		try {
			const date = new Date(dateString);
			return date.toLocaleString();
		} catch {
			return dateString;
		}
	};

	if (sessionLoading || loading) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="text-gray-400">Loading...</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight">
						Twilio Event Sync
					</h1>
					<p className="mt-2 text-gray-400">
						Manage Twilio event subscriptions and sync configuration
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowAddForm(!showAddForm)}
					className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
				>
					<Plus className="w-5 h-5" />
					Subscribe to Event
				</button>
			</div>

			{/* Error/Success Messages */}
			{error && (
				<div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
					{error}
				</div>
			)}
			{success && (
				<div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg">
					{success}
				</div>
			)}

			{/* Subscription Info */}
			{subscription && (
				<div className="bg-white/5 border border-white/10 rounded-xl p-6">
					<h2 className="text-xl font-bold mb-4">Subscription Details</h2>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">
								Description
							</label>
							<form onSubmit={handleUpdateDescription} className="flex gap-3">
								<input
									type="text"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder="Subscription description"
								/>
								<button
									type="submit"
									disabled={isUpdating}
									className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isUpdating ? "Updating..." : "Update"}
								</button>
							</form>
						</div>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="text-gray-400">SID</div>
								<div className="text-white font-mono">{subscription.sid || "N/A"}</div>
							</div>
							<div>
								<div className="text-gray-400">Sink SID</div>
								<div className="text-white font-mono">{subscription.sink_sid || "N/A"}</div>
							</div>
							<div>
								<div className="text-gray-400">Created</div>
								<div className="text-white">{formatDate(subscription.date_created)}</div>
							</div>
							<div>
								<div className="text-gray-400">Updated</div>
								<div className="text-white">{formatDate(subscription.date_updated)}</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Add Event Form */}
			{showAddForm && (
				<div className="bg-white/5 border border-white/10 rounded-xl p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-bold">Subscribe to Event</h2>
						<button
							type="button"
							onClick={() => {
								setShowAddForm(false);
								setEventType("");
								setSchemaVersion(undefined);
								setError(null);
							}}
							className="text-gray-400 hover:text-white transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
					<form onSubmit={handleAddEvent} className="space-y-4">
						<div>
							<label
								htmlFor="eventType"
								className="block text-sm font-medium text-gray-300 mb-2"
							>
								Event Type
							</label>
							<input
								id="eventType"
								type="text"
								value={eventType}
								onChange={(e) => setEventType(e.target.value)}
								placeholder="com.twilio.conversations.conversation.added"
								className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								required
							/>
							<p className="mt-1 text-xs text-gray-500">
								Example: com.twilio.conversations.conversation.added or com.twilio.messaging.inbound-message.received
							</p>
						</div>
						<div>
							<label
								htmlFor="schemaVersion"
								className="block text-sm font-medium text-gray-300 mb-2"
							>
								Schema Version (optional)
							</label>
							<input
								id="schemaVersion"
								type="number"
								value={schemaVersion || ""}
								onChange={(e) =>
									setSchemaVersion(
										e.target.value ? parseInt(e.target.value, 10) : undefined,
									)
								}
								placeholder="Leave empty for latest"
								className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								min="1"
							/>
						</div>
						<div className="flex gap-3">
							<button
								type="submit"
								disabled={isAdding}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isAdding ? "Subscribing..." : "Subscribe"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowAddForm(false);
									setEventType("");
									setSchemaVersion(undefined);
									setError(null);
								}}
								className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Subscribed Events List */}
			<div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
				<div className="p-6 border-b border-white/10">
					<div className="flex items-center gap-3">
						<CheckCircle className="w-6 h-6 text-indigo-500" />
						<h2 className="text-xl font-bold">
							Subscribed Events ({subscribedEvents.length})
						</h2>
					</div>
				</div>

				{subscribedEvents.length === 0 ? (
					<div className="p-12 text-center text-gray-400">
						No events subscribed yet
					</div>
				) : (
					<div className="divide-y divide-white/10">
						{subscribedEvents.map((event) => (
							<div
								key={event.type}
								className="p-6 hover:bg-white/5 transition-colors"
							>
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<div className="font-medium text-white mb-1">
											{event.type}
										</div>
										<div className="text-sm text-gray-400 space-y-1">
											{event.schema_version && (
												<div>Schema Version: {event.schema_version}</div>
											)}
											<div className="text-xs text-gray-500">
												Created: {formatDate(event.date_created)} | Updated:{" "}
												{formatDate(event.date_updated)}
											</div>
										</div>
									</div>
									<button
										type="button"
										onClick={() => handleRemoveEvent(event.type)}
										className="ml-4 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2"
										title="Unsubscribe from event"
									>
										<Trash className="w-4 h-4" />
										<span className="hidden sm:inline">Unsubscribe</span>
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}


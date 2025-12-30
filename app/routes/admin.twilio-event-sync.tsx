import { CheckCircle, Plus, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/app/lib/auth-client";
import { orpcClient } from "~/app/lib/orpc/client";
import type { EventsV1SubscriptionSubscribedEvent } from "~/app/lib/twilio/models";

export default function AdminTwilioEventSync() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [success, setSuccess] = useState<string | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [eventType, setEventType] = useState("");
	const [schemaVersion, setSchemaVersion] = useState<number | undefined>(
		undefined,
	);
	const [description, setDescription] = useState("");

	// Check auth
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}
	}, [session, sessionLoading, navigate]);

	// Fetch subscription and events
	const {
		data,
		isLoading: loading,
		error: queryError,
	} = useQuery({
		queryKey: ["twilio-event-sync"],
		queryFn: async () => {
			return await orpcClient.twilio.getEventSync();
		},
		enabled: !!session?.user,
	});

	const subscription = data?.subscription || null;
	const subscribedEvents: EventsV1SubscriptionSubscribedEvent[] =
		data?.subscribedEvents || [];
	const error = queryError
		? queryError instanceof Error
			? queryError.message
			: "Failed to fetch event sync"
		: null;

	useEffect(() => {
		if (subscription?.description) {
			setDescription(subscription.description);
		}
	}, [subscription?.description]);

	const updateDescriptionMutation = useMutation({
		mutationFn: async (description: string) => {
			return await orpcClient.twilio.updateEventSyncSubscription({
				description,
			});
		},
		onSuccess: () => {
			setSuccess("Subscription updated successfully");
			queryClient.invalidateQueries({ queryKey: ["twilio-event-sync"] });
		},
		onError: () => {
			setSuccess(null);
		},
	});

	const handleUpdateDescription = async (e: React.FormEvent) => {
		e.preventDefault();
		setSuccess(null);
		updateDescriptionMutation.mutate(description);
	};

	const addEventMutation = useMutation({
		mutationFn: async ({
			eventType,
			schemaVersion,
		}: {
			eventType: string;
			schemaVersion?: number;
		}) => {
			return await orpcClient.twilio.addEventSyncType({
				eventType,
				schemaVersion,
			});
		},
		onSuccess: () => {
			setSuccess("Event subscribed successfully");
			setEventType("");
			setSchemaVersion(undefined);
			setShowAddForm(false);
			queryClient.invalidateQueries({ queryKey: ["twilio-event-sync"] });
		},
		onError: () => {
			setSuccess(null);
		},
	});

	const handleAddEvent = async (e: React.FormEvent) => {
		e.preventDefault();
		setSuccess(null);
		addEventMutation.mutate({ eventType, schemaVersion });
	};

	const removeEventMutation = useMutation({
		mutationFn: async (eventType: string) => {
			return await orpcClient.twilio.deleteEventSyncType({ eventType });
		},
		onSuccess: () => {
			setSuccess("Event unsubscribed successfully");
			queryClient.invalidateQueries({ queryKey: ["twilio-event-sync"] });
		},
		onError: () => {
			setSuccess(null);
		},
	});

	const handleRemoveEvent = async (eventType: string) => {
		if (!confirm(`Are you sure you want to unsubscribe from ${eventType}?`)) {
			return;
		}

		setSuccess(null);
		removeEventMutation.mutate(eventType);
	};

	const formatDate = (dateString: string | null | undefined) => {
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
			{(error ||
				updateDescriptionMutation.error ||
				addEventMutation.error ||
				removeEventMutation.error) && (
				<div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
					{error ||
						(updateDescriptionMutation.error instanceof Error
							? updateDescriptionMutation.error.message
							: String(updateDescriptionMutation.error)) ||
						(addEventMutation.error instanceof Error
							? addEventMutation.error.message
							: String(addEventMutation.error)) ||
						(removeEventMutation.error instanceof Error
							? removeEventMutation.error.message
							: String(removeEventMutation.error))}
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
							<label
								htmlFor="subscription-description"
								className="block text-sm font-medium text-gray-300 mb-2"
							>
								Description
							</label>
							<form onSubmit={handleUpdateDescription} className="flex gap-3">
								<input
									id="subscription-description"
									type="text"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder="Subscription description"
								/>
								<button
									type="submit"
									disabled={updateDescriptionMutation.isPending}
									className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{updateDescriptionMutation.isPending
										? "Updating..."
										: "Update"}
								</button>
							</form>
						</div>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="text-gray-400">SID</div>
								<div className="text-white font-mono">
									{subscription.sid || "N/A"}
								</div>
							</div>
							<div>
								<div className="text-gray-400">Sink SID</div>
								<div className="text-white font-mono">
									{subscription.sink_sid || "N/A"}
								</div>
							</div>
							<div>
								<div className="text-gray-400">Created</div>
								<div className="text-white">
									{formatDate(subscription.date_created)}
								</div>
							</div>
							<div>
								<div className="text-gray-400">Updated</div>
								<div className="text-white">
									{formatDate(subscription.date_updated)}
								</div>
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
								Example: com.twilio.conversations.conversation.added or
								com.twilio.messaging.inbound-message.received
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
										e.target.value
											? Number.parseInt(e.target.value, 10)
											: undefined,
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
								disabled={addEventMutation.isPending}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{addEventMutation.isPending ? "Subscribing..." : "Subscribe"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowAddForm(false);
									setEventType("");
									setSchemaVersion(undefined);
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
								key={event.type || ""}
								className="p-6 hover:bg-white/5 transition-colors"
							>
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<div className="font-medium text-white mb-1">
											{event.type || "Unknown"}
										</div>
										<div className="text-sm text-gray-400 space-y-1">
											{event.schema_version && (
												<div className="text-xs text-gray-500">
													Schema Version: {event.schema_version}
												</div>
											)}
										</div>
									</div>
									<button
										type="button"
										onClick={() => handleRemoveEvent(event.type || "")}
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

import { ChatCircle, Plus, Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MAIN_CONVERSATION_UNIQUE_NAME } from "~/config/constants";
import { authClient } from "~/lib/auth-client";

type Participant = {
	sid: string;
	identity: string | null;
	address: string;
	proxyAddress: string;
};

type Message = {
	sid: string;
	index: number | null;
	author: string | null;
	body: string | null;
	dateCreated: string | null;
	dateUpdated: string | null;
	attributes: unknown;
};

export default function AdminWhatsApp() {
	const { data: session, isPending: sessionLoading } = authClient.useSession();
	const navigate = useNavigate();
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [conversationSid, setConversationSid] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [messagesLoading, setMessagesLoading] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Check auth and admin status
	useEffect(() => {
		if (sessionLoading) return;

		if (!session?.user) {
			navigate("/login");
			return;
		}
	}, [session, sessionLoading, navigate]);

	// Fetch conversation SID
	const fetchConversationSid = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/twilio/conversations?uniqueName=${MAIN_CONVERSATION_UNIQUE_NAME}`,
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch conversation");
			}

			if (data.sid) {
				setConversationSid(data.sid);
			}
		} catch (err) {
			console.error("Error fetching conversation SID:", err);
		}
	}, []);

	// Fetch participants
	const fetchParticipants = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch("/api/whatsapp/participants");
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch participants");
			}

			setParticipants(data.participants || []);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch participants",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	// Fetch messages
	const fetchMessages = useCallback(async () => {
		if (!conversationSid) return;

		try {
			setMessagesLoading(true);
			setError(null);
			const response = await fetch(
				`/api/twilio/messages?conversationSid=${conversationSid}`,
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch messages");
			}

			// Sort messages by index or dateCreated (newest first)
			const sortedMessages = (data.messages || []).sort(
				(a: Message, b: Message) => {
					if (a.index !== null && b.index !== null) {
						return b.index - a.index;
					}
					const aDate = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
					const bDate = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
					return bDate - aDate;
				},
			);

			setMessages(sortedMessages);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch messages");
		} finally {
			setMessagesLoading(false);
		}
	}, [conversationSid]);

	useEffect(() => {
		if (!session?.user) return;
		fetchConversationSid();
		fetchParticipants();
	}, [session, fetchConversationSid, fetchParticipants]);

	useEffect(() => {
		if (conversationSid) {
			fetchMessages();
		}
	}, [conversationSid, fetchMessages]);

	const handleAddParticipant = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAdding(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/whatsapp/add-participant", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ phoneNumber }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to add participant");
			}

			setSuccess(data.message || "Participant added successfully");
			setPhoneNumber("");
			setShowAddForm(false);
			await fetchParticipants();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to add participant",
			);
		} finally {
			setIsAdding(false);
		}
	};

	const handleRemoveParticipant = async (participantSid: string) => {
		if (
			!confirm(
				"Are you sure you want to remove this participant from the chat?",
			)
		) {
			return;
		}

		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/whatsapp/participants", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ participantSid }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to remove participant");
			}

			setSuccess("Participant removed successfully");
			await fetchParticipants();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to remove participant",
			);
		}
	};

	const formatPhoneNumber = (address: string) => {
		if (!address) return "N/A";
		// Remove whatsapp: prefix if present
		return address.replace(/^whatsapp:/, "");
	};

	const handleDeleteMessage = async (messageSid: string) => {
		if (!conversationSid) return;

		if (!confirm("Are you sure you want to delete this message?")) {
			return;
		}

		setError(null);
		setSuccess(null);

		try {
			const response = await fetch("/api/twilio/messages", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					conversationSid,
					messageSid,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to delete message");
			}

			setSuccess("Message deleted successfully");
			await fetchMessages();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete message");
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

	if (sessionLoading) {
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
						WhatsApp Participants
					</h1>
					<p className="mt-2 text-gray-400">
						Manage participants in the main WhatsApp chat
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowAddForm(!showAddForm)}
					className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
				>
					<Plus className="w-5 h-5" />
					Add Participant
				</button>
			</div>

			{/* Add Participant Form */}
			{showAddForm && (
				<div className="bg-white/5 border border-white/10 rounded-xl p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-bold">Add New Participant</h2>
						<button
							type="button"
							onClick={() => {
								setShowAddForm(false);
								setPhoneNumber("");
								setError(null);
							}}
							className="text-gray-400 hover:text-white transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
					<form onSubmit={handleAddParticipant} className="space-y-4">
						<div>
							<label
								htmlFor="phoneNumber"
								className="block text-sm font-medium text-gray-300 mb-2"
							>
								Phone Number
							</label>
							<input
								id="phoneNumber"
								type="text"
								value={phoneNumber}
								onChange={(e) => setPhoneNumber(e.target.value)}
								placeholder="+1234567890 or whatsapp:+1234567890"
								className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								required
							/>
							<p className="mt-1 text-xs text-gray-500">
								Enter phone number with country code (e.g., +1234567890)
							</p>
						</div>
						<div className="flex gap-3">
							<button
								type="submit"
								disabled={isAdding}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isAdding ? "Adding..." : "Add Participant"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowAddForm(false);
									setPhoneNumber("");
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

			{/* Messages */}
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

			{/* Messages List */}
			<div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
				<div className="p-6 border-b border-white/10">
					<div className="flex items-center gap-3">
						<ChatCircle className="w-6 h-6 text-indigo-500" />
						<h2 className="text-xl font-bold">Messages ({messages.length})</h2>
					</div>
				</div>

				{messagesLoading ? (
					<div className="p-12 text-center text-gray-400">
						Loading messages...
					</div>
				) : messages.length === 0 ? (
					<div className="p-12 text-center text-gray-400">
						No messages found
					</div>
				) : (
					<div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
						{messages.map((message) => (
							<div
								key={message.sid}
								className="p-6 hover:bg-white/5 transition-colors"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
												<ChatCircle className="w-5 h-5 text-indigo-400" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="font-medium text-white">
													{message.author || "Unknown"}
												</div>
												<div className="text-sm text-gray-400">
													{formatDate(message.dateCreated)}
												</div>
											</div>
										</div>
										<div className="ml-13 mt-2">
											<div className="text-white whitespace-pre-wrap wrap-break-word">
												{message.body || "(No content)"}
											</div>
											{message.index !== null && (
												<div className="text-xs text-gray-500 font-mono mt-2">
													Index: {message.index} | SID: {message.sid}
												</div>
											)}
										</div>
									</div>
									<button
										type="button"
										onClick={() => handleDeleteMessage(message.sid)}
										className="ml-4 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2 shrink-0"
										title="Delete message"
									>
										<Trash className="w-4 h-4" />
										<span className="hidden sm:inline">Delete</span>
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Participants List */}
			<div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
				<div className="p-6 border-b border-white/10">
					<div className="flex items-center gap-3">
						<ChatCircle className="w-6 h-6 text-indigo-500" />
						<h2 className="text-xl font-bold">
							Participants ({participants.length})
						</h2>
					</div>
				</div>

				{loading ? (
					<div className="p-12 text-center text-gray-400">
						Loading participants...
					</div>
				) : participants.length === 0 ? (
					<div className="p-12 text-center text-gray-400">
						No participants found
					</div>
				) : (
					<div className="divide-y divide-white/10">
						{participants.map((participant) => (
							<div
								key={participant.sid}
								className="p-6 hover:bg-white/5 transition-colors"
							>
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
												<ChatCircle className="w-5 h-5 text-indigo-400" />
											</div>
											<div>
												<div className="font-medium text-white">
													{formatPhoneNumber(participant.address)}
												</div>
												{participant.identity && (
													<div className="text-sm text-gray-400">
														Identity: {participant.identity}
													</div>
												)}
												{participant.proxyAddress && (
													<div className="text-xs text-gray-500 mt-1">
														Proxy: {formatPhoneNumber(participant.proxyAddress)}
													</div>
												)}
											</div>
										</div>
										<div className="text-xs text-gray-500 font-mono ml-13">
											SID: {participant.sid}
										</div>
									</div>
									<button
										type="button"
										onClick={() => handleRemoveParticipant(participant.sid)}
										className="ml-4 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2"
										title="Remove participant"
									>
										<Trash className="w-4 h-4" />
										<span className="hidden sm:inline">Remove</span>
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

import { CaretDown, PencilLine, Scales, Trophy } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import MDEditor from "@uiw/react-md-editor";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "~/app/components/ui/avatar";
import { Badge } from "~/app/components/ui/badge";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/app/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/app/components/ui/dialog";
import { Label } from "~/app/components/ui/label";
import { Skeleton } from "~/app/components/ui/skeleton";
import { Textarea } from "~/app/components/ui/textarea";
import { authClient } from "~/app/lib/auth-client";
import { orpcClient } from "~/app/lib/orpc/client";
import {
	demeritKeys,
	useCharter,
	useDemeritsByUserId,
	useLeaderboard,
	usePendingCharterProposals,
} from "~/app/lib/orpc/hooks/use-demerit";
import type { Route } from "./+types/_app.charter";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Global Charter - Gnar Dawgs" },
		{
			name: "description",
			content:
				"The rules of the Gnar Dawgs collective and the demerit leaderboard.",
		},
	];
}

function LeaderboardEntry({
	entry,
	index,
}: {
	entry: {
		userId: string;
		name: string | null;
		image: string | null;
		count: number;
	};
	index: number;
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const { data: demerits, isLoading: isLoadingDemerits } = useDemeritsByUserId(
		isOpen ? entry.userId : undefined,
	);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group cursor-pointer w-full">
					<div className="flex items-center gap-3">
						<div className="relative">
							<Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm">
								<AvatarImage src={entry.image || ""} />
								<AvatarFallback className="bg-slate-200 text-slate-700 font-bold uppercase">
									{entry.name?.[0]}
								</AvatarFallback>
							</Avatar>
							{index < 3 && (
								<span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm">
									{index + 1}
								</span>
							)}
						</div>
						<span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
							{entry.name}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="destructive"
							className="h-7 min-w-8 flex justify-center font-black text-sm bg-red-600 hover:bg-red-700 border-none shadow-sm"
						>
							{entry.count}
						</Badge>
						<CaretDown
							className={`w-4 h-4 text-slate-400 transition-transform ${
								isOpen ? "rotate-180" : ""
							}`}
						/>
					</div>
				</div>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="px-4 pb-4 border-t border-red-100 dark:border-red-950/30 bg-slate-50/50 dark:bg-slate-900/20">
					{isLoadingDemerits ? (
						<div className="pt-4 space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-4/6" />
						</div>
					) : !demerits || demerits.length === 0 ? (
						<p className="pt-4 text-sm text-muted-foreground italic">
							No active demerits found.
						</p>
					) : (
						<ul className="pt-4 space-y-2 list-disc list-inside">
							{(demerits || []).map((demerit) => (
								<li
									key={demerit.id}
									className="text-sm text-slate-700 dark:text-slate-300"
								>
									<span className="font-medium">{demerit.reason}</span>
									{demerit.fromUserName && (
										<span className="text-muted-foreground text-xs ml-2">
											— {demerit.fromUserName}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export default function CharterPage() {
	const queryClient = useQueryClient();
	const { data: charterData, isLoading: isCharterLoading } = useCharter();
	const { data: leaderboardData, isLoading: isLeaderboardLoading } =
		useLeaderboard();
	const { data: proposals, isLoading: isLoadingProposals } =
		usePendingCharterProposals();
	const { data: session } = authClient.useSession();

	const [isDialogOpen, setIsDialogOpen] = React.useState(false);
	const [proposedContent, setProposedContent] = React.useState("");
	const [reason, setReason] = React.useState("");

	React.useEffect(() => {
		if (charterData?.content) {
			setProposedContent(charterData.content);
		}
	}, [charterData]);

	const proposeMutation = useMutation({
		mutationFn: (args: { proposedContent: string; reason: string }) =>
			orpcClient.demerit.proposeCharterUpdate(args),
		onSuccess: () => {
			toast.success("Proposal submitted for review! 🐢");
			setIsDialogOpen(false);
			setReason("");
		},
		onError: (error) => {
			toast.error(
				`Failed to submit proposal: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		},
	});

	const handlePropose = () => {
		if (!reason.trim()) {
			toast.error("Please provide a reason for the change.");
			return;
		}
		proposeMutation.mutate({ proposedContent, reason });
	};

	const approveMutation = useMutation({
		mutationFn: (proposalId: string) =>
			orpcClient.demerit.approveCharterProposal({ proposalId }),
		onSuccess: () => {
			toast.success("Proposal approved and charter updated! 🐾");
			queryClient.invalidateQueries({ queryKey: demeritKeys.all });
		},
		onError: (error) => {
			toast.error(
				`Failed to approve proposal: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: (proposalId: string) =>
			orpcClient.demerit.rejectCharterProposal({ proposalId }),
		onSuccess: () => {
			toast.success("Proposal rejected.");
			queryClient.invalidateQueries({ queryKey: demeritKeys.proposals() });
		},
		onError: (error) => {
			toast.error(
				`Failed to reject proposal: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		},
	});

	return (
		<div className="container mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">
					Global Charter
				</h1>
				<p className="text-muted-foreground font-medium">
					The code we live by. Violations result in demerits.
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
				{/* Charter Content */}
				<Card className="lg:col-span-2 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
					<CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Scales className="w-6 h-6 text-slate-700 dark:text-slate-300" />
								<CardTitle className="text-xl">The Rules</CardTitle>
							</div>
							<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
								<DialogTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="gap-2 font-bold uppercase tracking-wider text-xs italic"
									>
										<PencilLine className="w-4 h-4" />
										Propose Change
									</Button>
								</DialogTrigger>
								<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
									<DialogHeader className="p-6 border-b bg-slate-50 dark:bg-slate-900/50">
										<DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
											Propose Amendment
										</DialogTitle>
										<DialogDescription>
											Propose a change to the Global Charter. Your amendment
											will be reviewed by the collective.
										</DialogDescription>
									</DialogHeader>
									<div className="flex-1 overflow-auto p-6 space-y-6">
										<div className="space-y-2">
											<Label
												htmlFor="reason"
												className="font-bold uppercase text-xs text-slate-500"
											>
												Reason for Change
											</Label>
											<Textarea
												id="reason"
												placeholder="Briefly explain why this change is needed..."
												value={reason}
												onChange={(e) => setReason(e.target.value)}
												className="min-h-[80px] resize-none border-2 focus-visible:ring-red-500"
											/>
										</div>
										<div className="space-y-2 flex-1 flex flex-col min-h-[400px]">
											<Label className="font-bold uppercase text-xs text-slate-500">
												Proposed Content
											</Label>
											<div className="flex-1 border-2 rounded-md overflow-hidden dark:bg-slate-950">
												<MDEditor
													value={proposedContent}
													onChange={(value) => setProposedContent(value || "")}
													preview="edit"
													height="100%"
													minHeight={350}
												/>
											</div>
										</div>
									</div>
									<DialogFooter className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 gap-2">
										<Button
											variant="ghost"
											onClick={() => setIsDialogOpen(false)}
											disabled={proposeMutation.isPending}
										>
											Cancel
										</Button>
										<Button
											className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic px-8"
											onClick={handlePropose}
											disabled={proposeMutation.isPending}
										>
											{proposeMutation.isPending
												? "Submitting..."
												: "Submit Proposal"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
						<CardDescription className="text-slate-600 dark:text-slate-400">
							Established by the elders of the Gnar Dawgs collective.
						</CardDescription>
					</CardHeader>

					<CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
						{isCharterLoading ? (
							<div className="space-y-4">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-11/12" />
								<Skeleton className="h-4 w-4/5" />
								<Skeleton className="h-32 w-full mt-8" />
							</div>
						) : (
							<div className="space-y-4 leading-relaxed">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{charterData?.content || ""}
								</ReactMarkdown>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Leaderboard */}
				<Card className="border-2 border-red-100 dark:border-red-950/30 shadow-lg sticky top-8">
					<CardHeader className="bg-red-50/50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-950/30">
						<div className="flex items-center gap-2">
							<Trophy className="w-6 h-6 text-red-600 dark:text-red-400" />
							<CardTitle className="text-xl">Demerit Board</CardTitle>
						</div>
						<CardDescription className="text-red-700/70 dark:text-red-400/70 py-1">
							Members with active charter violations.
						</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						{isLeaderboardLoading ? (
							<div className="p-6 space-y-4">
								{[1, 2, 3].map((i) => (
									<div key={i} className="flex items-center gap-4">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="flex-1 space-y-2">
											<Skeleton className="h-4 w-1/2" />
										</div>
										<Skeleton className="h-6 w-8 rounded-full" />
									</div>
								))}
							</div>
						) : (
							<div className="divide-y divide-red-100 dark:divide-red-950/30">
								{!leaderboardData || leaderboardData.length === 0 ? (
									<div className="p-12 text-center space-y-3">
										<p className="text-4xl">🐾</p>
										<p className="text-sm text-muted-foreground italic font-medium">
											No active demerits.
											<br />
											Everyone is being a good dawg.
										</p>
									</div>
								) : (
									leaderboardData.map((entry, index) => (
										<LeaderboardEntry
											key={entry.userId}
											entry={entry}
											index={index}
										/>
									))
								)}
							</div>
						)}
					</CardContent>
					<div className="p-4 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-center text-muted-foreground border-t">
						Demerits are cleared when you buy the affected party a cold one. 🍻
					</div>
				</Card>

				{/* Pending Proposals Section */}
				<div className="lg:col-span-2 space-y-4">
					<h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
						Pending Proposals
						{proposals && proposals.length > 0 && (
							<Badge className="bg-red-600 border-none font-black">
								{proposals.length}
							</Badge>
						)}
					</h2>

					{isLoadingProposals ? (
						<div className="space-y-4">
							<Skeleton className="h-32 w-full" />
						</div>
					) : !proposals || proposals.length === 0 ? (
						<Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-transparent">
							<CardContent className="p-12 text-center text-muted-foreground italic">
								No pending amendments at this time.
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 gap-4">
							{proposals.map((proposal) => (
								<Card
									key={proposal.id}
									className="border-2 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden"
								>
									<div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
										<div className="flex-1 p-6 space-y-4">
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarImage src="" />
													<AvatarFallback className="text-[10px] font-bold">
														{proposal.proposerName?.[0]}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="text-sm font-bold">
														{proposal.proposerName}
													</p>
													<p className="text-[10px] text-muted-foreground uppercase">
														{new Date(proposal.createdAt).toLocaleDateString()}
													</p>
												</div>
											</div>

											<div className="space-y-1">
												<p className="text-[10px] uppercase font-black text-slate-400">
													Reason
												</p>
												<p className="text-sm font-medium italic text-slate-700 dark:text-slate-300">
													"{proposal.reason}"
												</p>
											</div>

											<div className="space-y-1">
												<p className="text-[10px] uppercase font-black text-slate-400">
													Proposed Change
												</p>
												<div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded border border-slate-100 dark:border-slate-800 max-h-[200px] overflow-auto text-sm font-mono whitespace-pre-wrap">
													{proposal.proposedContent}
												</div>
											</div>
										</div>
										<div className="w-full md:w-48 p-6 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-center gap-3">
											<Button
												className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
												onClick={() => approveMutation.mutate(proposal.id)}
												disabled={
													approveMutation.isPending ||
													proposal.proposerId === session?.user?.id
												}
											>
												Approve
											</Button>
											<Button
												variant="outline"
												className="w-full text-red-500 border-red-100 hover:bg-red-50 dark:border-red-900/20 dark:hover:bg-red-900/10"
												onClick={() => rejectMutation.mutate(proposal.id)}
												disabled={rejectMutation.isPending}
											>
												Reject
											</Button>
											{proposal.proposerId === session?.user?.id && (
												<p className="text-[10px] text-center text-muted-foreground italic">
													You cannot approve your own proposal.
												</p>
											)}
										</div>
									</div>
								</Card>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

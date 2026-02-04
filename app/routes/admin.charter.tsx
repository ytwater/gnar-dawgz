import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import MDEditor from "@uiw/react-md-editor";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { orpcClient } from "~/app/lib/orpc/client";
import {
	demeritKeys,
	useCharter,
	usePendingCharterProposals,
} from "~/app/lib/orpc/hooks/use-demerit";
import type { Route } from "./+types/admin.charter";

export function meta(_: Route.MetaArgs) {
	return [{ title: "Edit Charter - Gnar Dawgs Admin" }];
}

export default function AdminCharterPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: charterData, isLoading } = useCharter();
	const { data: proposals, isLoading: isLoadingProposals } =
		usePendingCharterProposals();
	const [content, setContent] = useState("");

	useEffect(() => {
		if (charterData?.content) {
			setContent(charterData.content);
		}
	}, [charterData]);

	const updateMutation = useMutation({
		mutationFn: (newContent: string) =>
			orpcClient.demerit.updateCharter({ content: newContent }),
		onSuccess: () => {
			toast.success("Charter updated successfully! 🐾");
			queryClient.invalidateQueries({ queryKey: ["demerit", "charter"] });
		},
		onError: (error) => {
			toast.error(
				`Failed to update charter: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		},
	});

	const handleSave = () => {
		updateMutation.mutate(content);
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
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<Link
							to="/admin"
							className="text-muted-foreground hover:text-primary transition-colors"
						>
							<ArrowLeft className="w-5 h-5" />
						</Link>
						<h1 className="text-3xl font-black tracking-tight uppercase italic text-slate-900 dark:text-white">
							Manage Charter
						</h1>
					</div>
					<p className="text-muted-foreground font-medium">
						Edit the Global Charter content using Markdown.
					</p>
				</div>
				<Button
					onClick={handleSave}
					disabled={updateMutation.isPending || isLoading}
					className="bg-red-600 hover:bg-red-700 font-bold shadow-lg shadow-red-600/20"
				>
					{updateMutation.isPending ? (
						<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
					) : (
						<FloppyDisk className="w-5 h-5 mr-2" />
					)}
					{updateMutation.isPending ? "Saving..." : "Save Charter"}
				</Button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
				{/* Editor */}
				<Card className="min-h-[600px] flex flex-col shadow-xl border-2 border-slate-200 dark:border-slate-800">
					<CardHeader className="border-b bg-slate-50 dark:bg-slate-900/50">
						<CardTitle className="text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400">
							Markdown Editor
						</CardTitle>
						<CardDescription>
							Changes are not saved until you click Save.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 p-0 overflow-hidden">
						<div className="h-full min-h-[500px] [&_.w-md-editor]:h-full [&_.w-md-editor-text]:min-h-[500px] [&_.w-md-editor]:border-none [&_.w-md-editor-text-textarea]:bg-transparent [&_.w-md-editor-text-textarea]:text-foreground [&_.w-md-editor-text-textarea]:font-mono [&_.w-md-editor-text-textarea]:text-sm [&_.w-md-editor-text-textarea]:leading-relaxed [&_.w-md-editor-text-textarea]:p-8 [&_.w-md-editor-text-textarea]:focus:outline-none [&_.w-md-editor-toolbar]:bg-slate-50 [&_.w-md-editor-toolbar]:dark:bg-slate-900/50 [&_.w-md-editor-toolbar]:border-b [&_.w-md-editor-toolbar]:border-border">
							<MDEditor
								value={content}
								onChange={(value) => setContent(value || "")}
								preview="edit"
								hideToolbar={false}
								visibleDragbar={false}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Pending Proposals */}
				<Card className="shadow-xl border-2 border-slate-200 dark:border-slate-800 flex flex-col">
					<CardHeader className="border-b bg-slate-50 dark:bg-slate-900/50">
						<CardTitle className="text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400">
							Pending Proposals
						</CardTitle>
						<CardDescription>
							Proposals from members that need approval.
						</CardDescription>
					</CardHeader>
					<CardContent className="p-0 flex-1 overflow-auto">
						{isLoadingProposals ? (
							<div className="p-8 text-center text-muted-foreground italic">
								Loading proposals...
							</div>
						) : !proposals || proposals.length === 0 ? (
							<div className="p-8 text-center text-muted-foreground italic">
								No pending proposals.
							</div>
						) : (
							<div className="divide-y divide-slate-100 dark:divide-slate-800">
								{proposals.map((proposal) => (
									<div key={proposal.id} className="p-6 space-y-4">
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-1">
												<p className="font-bold text-slate-900 dark:text-white">
													Proposed by {proposal.proposerName}
												</p>
												<p className="text-sm text-muted-foreground">
													{new Date(proposal.createdAt).toLocaleString()}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Button
													size="sm"
													variant="outline"
													className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
													onClick={() => rejectMutation.mutate(proposal.id)}
													disabled={rejectMutation.isPending}
												>
													Reject
												</Button>
												<Button
													size="sm"
													className="bg-green-600 hover:bg-green-700 text-white"
													onClick={() => approveMutation.mutate(proposal.id)}
													disabled={approveMutation.isPending}
												>
													Approve
												</Button>
											</div>
										</div>
										<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
											<div>
												<p className="text-[10px] uppercase font-black text-slate-400 mb-1">
													Reason
												</p>
												<p className="text-sm italic">{proposal.reason}</p>
											</div>
											<div>
												<p className="text-[10px] uppercase font-black text-slate-400 mb-1">
													Proposed Change
												</p>
												<div className="text-sm font-mono whitespace-pre-wrap p-3 bg-white dark:bg-black rounded border border-slate-200 dark:border-slate-800 max-h-[300px] overflow-auto">
													{proposal.proposedContent}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

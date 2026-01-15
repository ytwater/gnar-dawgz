import { Scales, Trophy } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "~/app/components/ui/avatar";
import { Badge } from "~/app/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Skeleton } from "~/app/components/ui/skeleton";
import { useCharter, useLeaderboard } from "~/app/lib/orpc/hooks/use-demerit";
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

export default function CharterPage() {
	const { data: charterData, isLoading: isCharterLoading } = useCharter();
	const { data: leaderboardData, isLoading: isLeaderboardLoading } =
		useLeaderboard();

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
						<div className="flex items-center gap-2">
							<Scales className="w-6 h-6 text-slate-700 dark:text-slate-300" />
							<CardTitle className="text-xl">The Rules</CardTitle>
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
										<div
											key={entry.userId}
											className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group"
										>
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
											<Badge
												variant="destructive"
												className="h-7 min-w-8 flex justify-center font-black text-sm bg-red-600 hover:bg-red-700 border-none shadow-sm"
											>
												{entry.count}
											</Badge>
										</div>
									))
								)}
							</div>
						)}
					</CardContent>
					<div className="p-4 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-center text-muted-foreground border-t">
						Demerits are cleared when you buy the affected party a cold one. 🍻
					</div>
				</Card>
			</div>
		</div>
	);
}

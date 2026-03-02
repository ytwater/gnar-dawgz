import {
	ArrowLeft,
	ChatCircle,
	Coins,
	Image as ImageIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";
import { Link, redirect } from "react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/app/components/ui/table";
import { getDb } from "~/app/lib/db";
import { aiUsageLogs, users } from "~/app/lib/schema";
import type { Route } from "./+types/admin.costs.user.$userId";

export async function loader({ params, context }: Route.LoaderArgs) {
	const { userId } = params;
	const db = getDb(context.cloudflare.env.DB);

	// Fetch user details
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw redirect("/admin/costs");
	}

	// 1. Individual User Totals
	const [totals] = await db
		.select({
			totalCost: sql<number>`sum(${aiUsageLogs.totalCost})`,
			totalTokens: sql<number>`sum(${aiUsageLogs.promptTokens} + ${aiUsageLogs.completionTokens})`,
			totalImages: sql<number>`sum(${aiUsageLogs.imagesGenerated})`,
		})
		.from(aiUsageLogs)
		.where(eq(aiUsageLogs.userId, userId));

	// 2. Timeline (Past 30 Days daily spend)
	const timelineResult = await db
		.select({
			date: sql<string>`date(${aiUsageLogs.createdAt} / 1000, 'unixepoch')`,
			cost: sql<number>`sum(${aiUsageLogs.totalCost})`,
		})
		.from(aiUsageLogs)
		.where(
			and(
				eq(aiUsageLogs.userId, userId),
				sql`${aiUsageLogs.createdAt} > (unixepoch() - 30*24*60*60) * 1000`,
			),
		)
		.groupBy(sql`date(${aiUsageLogs.createdAt} / 1000, 'unixepoch')`)
		.orderBy(sql`date(${aiUsageLogs.createdAt} / 1000, 'unixepoch')`);

	// 3. Activity Log (Last 50 entries)
	const activityLog = await db
		.select()
		.from(aiUsageLogs)
		.where(eq(aiUsageLogs.userId, userId))
		.orderBy(desc(aiUsageLogs.createdAt))
		.limit(50);

	return {
		user,
		totals: {
			cost: totals?.totalCost || 0,
			tokens: totals?.totalTokens || 0,
			images: totals?.totalImages || 0,
		},
		timeline: timelineResult,
		activityLog,
	};
}

export default function AdminUserCostDrilldown({
	loaderData,
}: Route.ComponentProps) {
	const { user, totals, timeline, activityLog } = loaderData;

	return (
		<div className="space-y-8 pb-10">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/admin/costs">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight">
						User Drilldown: {user.name}
					</h1>
					<p className="mt-2 text-muted-foreground">
						Detailed activity log for {user.email}
					</p>
				</div>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="bg-primary/5 border-primary/20">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-primary">
							Total User Spend
						</CardTitle>
						<Coins className="h-4 w-4 text-primary" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">${totals.cost.toFixed(3)}</div>
						<p className="text-xs text-muted-foreground">
							All-time API contribution
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
						<ChatCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totals.tokens.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							Total chat/analysis units
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Images Generated
						</CardTitle>
						<ImageIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totals.images.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							Total artwork creators
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Timeline Chart */}
			<Card>
				<CardHeader>
					<CardTitle>Spend Timeline (Last 30 Days)</CardTitle>
					<CardDescription>
						Daily API cost distribution over the past month
					</CardDescription>
				</CardHeader>
				<CardContent className="h-[300px]">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={timeline}>
							<defs>
								<linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#0088FE" stopOpacity={0.1} />
									<stop offset="95%" stopColor="#0088FE" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid
								strokeDasharray="3 3"
								vertical={false}
								stroke="#E2E8F0"
							/>
							<XAxis
								dataKey="date"
								fontSize={11}
								tickLine={false}
								axisLine={false}
								tickFormatter={(v) => v.split("-").slice(1).join("/")}
							/>
							<YAxis
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(v) => `$${v}`}
							/>
							<Tooltip
								formatter={(value: number) => [`$${value.toFixed(4)}`, "Spend"]}
								contentStyle={{
									borderRadius: "8px",
									border: "none",
									boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
								}}
								labelStyle={{ fontWeight: "bold", color: "#64748B" }}
								labelFormatter={(label) =>
									format(new Date(label), "MMM do, yyyy")
								}
							/>
							<Area
								type="monotone"
								dataKey="cost"
								stroke="#0088FE"
								fillOpacity={1}
								fill="url(#colorCost)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			{/* Detailed Log Book */}
			<Card>
				<CardHeader>
					<CardTitle>Detailed Ledger</CardTitle>
					<CardDescription>Last 50 recorded AI transactions</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date / Time</TableHead>
								<TableHead>Feature</TableHead>
								<TableHead>Model / Provider</TableHead>
								<TableHead className="text-right">Usage</TableHead>
								<TableHead className="text-right font-bold">Cost</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{activityLog.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={5}
										className="text-center py-10 text-muted-foreground"
									>
										No recent activity found.
									</TableCell>
								</TableRow>
							)}
							{activityLog.map((log) => (
								<TableRow key={log.id}>
									<TableCell className="text-xs font-mono">
										{format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
									</TableCell>
									<TableCell>
										<span className="capitalize">
											{log.feature.replace("_", " ")}
										</span>
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{log.modelId}
									</TableCell>
									<TableCell className="text-right">
										{log.imagesGenerated ? (
											<span className="text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 text-secondary-foreground font-medium">
												<ImageIcon size={12} /> {log.imagesGenerated} img
											</span>
										) : (
											<span className="text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 text-secondary-foreground font-medium">
												<ChatCircle size={12} />{" "}
												{(
													(log.promptTokens || 0) + (log.completionTokens || 0)
												).toLocaleString()}{" "}
												tokens
											</span>
										)}
									</TableCell>
									<TableCell className="text-right font-bold text-primary">
										${log.totalCost.toFixed(4)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

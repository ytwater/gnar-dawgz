import { Coins, Cpu, Image as ImageIcon } from "@phosphor-icons/react";
import { desc, eq, sql } from "drizzle-orm";
import { Link } from "react-router";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
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
import type { Route } from "./+types/admin.costs._index";

export async function loader({ context }: Route.LoaderArgs) {
	const db = getDb(context.cloudflare.env.DB);

	// 1. Total Costs Stats
	const [totals] = await db
		.select({
			totalCost: sql<number>`sum(${aiUsageLogs.totalCost})`,
			totalTokens: sql<number>`sum(${aiUsageLogs.promptTokens} + ${aiUsageLogs.completionTokens})`,
			totalImages: sql<number>`sum(${aiUsageLogs.imagesGenerated})`,
		})
		.from(aiUsageLogs);

	// 2. Cost by Feature (Pie Chart)
	const featureBreakdown = await db
		.select({
			name: aiUsageLogs.feature,
			value: sql<number>`sum(${aiUsageLogs.totalCost})`,
		})
		.from(aiUsageLogs)
		.groupBy(aiUsageLogs.feature);

	// 3. Cost by User (Table)
	const userCosts = await db
		.select({
			userId: users.id,
			userName: users.name,
			userEmail: users.email,
			totalCost: sql<number>`sum(${aiUsageLogs.totalCost})`,
			imageCount: sql<number>`sum(${aiUsageLogs.imagesGenerated})`,
			tokenCount: sql<number>`sum(${aiUsageLogs.promptTokens} + ${aiUsageLogs.completionTokens})`,
		})
		.from(aiUsageLogs)
		.innerJoin(users, eq(aiUsageLogs.userId, users.id))
		.groupBy(users.id)
		.orderBy(desc(sql`sum(${aiUsageLogs.totalCost})`))
		.limit(20);

	return {
		totals: {
			cost: totals?.totalCost || 0,
			tokens: totals?.totalTokens || 0,
			images: totals?.totalImages || 0,
		},
		featureBreakdown,
		userCosts,
	};
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function AdminCostsDashboard({
	loaderData,
}: Route.ComponentProps) {
	const { totals, featureBreakdown, userCosts } = loaderData;

	return (
		<div className="space-y-8 pb-10">
			<div>
				<h1 className="text-4xl font-extrabold tracking-tight">
					AI Costs Overview
				</h1>
				<p className="mt-2 text-muted-foreground">
					Monitor AI resource consumption across all features.
				</p>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="bg-primary/5 border-primary/20">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-primary">
							Total Spend
						</CardTitle>
						<Coins className="h-4 w-4 text-primary" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">${totals.cost.toFixed(2)}</div>
						<p className="text-xs text-muted-foreground">
							All-time API expenses
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
						<Cpu className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totals.tokens.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							Text processing units
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
							Visual assets created
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Feature Breakdown Chart */}
				<Card>
					<CardHeader>
						<CardTitle>Spend by Feature</CardTitle>
						<CardDescription>
							Relative cost of different AI capabilities
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={featureBreakdown}
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={80}
									paddingAngle={5}
									dataKey="value"
									label={({ name, percent }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
								>
									{featureBreakdown.map((entry, index) => (
										<Cell
											key={`cell-${entry.name}`}
											fill={COLORS[index % COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip
									formatter={(value: number) => `$${value.toFixed(4)}`}
									contentStyle={{
										borderRadius: "8px",
										border: "none",
										boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
									}}
								/>
							</PieChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>

				{/* Provider distribution could go here, or simple Bar chart */}
				<Card>
					<CardHeader>
						<CardTitle>Feature Cost Comparison</CardTitle>
						<CardDescription>
							Total dollars spent per product area
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={featureBreakdown}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="#E2E8F0"
								/>
								<XAxis
									dataKey="name"
									fontSize={12}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(v) => `$${v}`}
								/>
								<Tooltip
									cursor={{ fill: "transparent" }}
									formatter={(value: number) => [
										`$${value.toFixed(4)}`,
										"Cost",
									]}
									contentStyle={{
										borderRadius: "8px",
										border: "none",
										boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
									}}
								/>
								<Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			</div>

			{/* User Table */}
			<Card>
				<CardHeader>
					<CardTitle>Usage by User</CardTitle>
					<CardDescription>
						Drill down into specific member consumption
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead className="text-right">Images</TableHead>
								<TableHead className="text-right">Tokens</TableHead>
								<TableHead className="text-right font-bold">
									Total Cost
								</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{userCosts.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={5}
										className="text-center py-10 text-muted-foreground"
									>
										No usage recorded yet.
									</TableCell>
								</TableRow>
							)}
							{userCosts.map((user) => (
								<TableRow key={user.userId}>
									<TableCell>
										<div className="flex flex-col">
											<span className="font-medium text-foreground">
												{user.userName}
											</span>
											<span className="text-xs text-muted-foreground">
												{user.userEmail}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-right">
										{user.imageCount}
									</TableCell>
									<TableCell className="text-right">
										{user.tokenCount.toLocaleString()}
									</TableCell>
									<TableCell className="text-right font-bold text-primary">
										${user.totalCost.toFixed(3)}
									</TableCell>
									<TableCell className="text-right">
										<Button variant="ghost" size="sm" asChild>
											<Link to={`/admin/costs/user/${user.userId}`}>
												Details
											</Link>
										</Button>
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

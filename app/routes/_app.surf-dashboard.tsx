import { and, asc, eq, gte } from "drizzle-orm";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import { Layout } from "~/app/components/layout";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/app/components/ui/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/app/components/ui/select";
import { getDb } from "~/app/lib/db";
import {
	surfForecasts,
	surfSpots,
	tideForecasts,
} from "~/app/lib/surf-forecast-schema";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	const db = getDb(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const now = new Date();

	const allSpots = await db
		.select()
		.from(surfSpots)
		.where(eq(surfSpots.isActive, true));

	// Determine default spot: try Torrey Pines by name or id, otherwise first active spot
	let defaultSpotId: string | null = null;
	const torreyPines = allSpots.find(
		(spot) =>
			spot.id === "torrey_pines" ||
			spot.name.toLowerCase().includes("torrey pines"),
	);
	if (torreyPines) {
		defaultSpotId = torreyPines.id;
	} else if (allSpots.length > 0) {
		defaultSpotId = allSpots[0].id;
	}

	let selectedSpotId =
		url.searchParams.get("spotId") || defaultSpotId || "torrey_pines";

	// Validate that the selected spot exists and is active
	let selectedSpot = allSpots.find((spot) => spot.id === selectedSpotId);
	if (!selectedSpot && defaultSpotId) {
		// Fall back to default if selected spot doesn't exist
		selectedSpotId = defaultSpotId;
		selectedSpot = allSpots.find((spot) => spot.id === selectedSpotId);
	} else if (!selectedSpot && allSpots.length > 0) {
		// Fall back to first active spot if default doesn't exist
		selectedSpotId = allSpots[0].id;
		selectedSpot = allSpots[0];
	}

	const allWaves = await db
		.select()
		.from(surfForecasts)
		.where(
			and(
				eq(surfForecasts.spotId, selectedSpotId),
				gte(surfForecasts.timestamp, now),
			),
		)
		.orderBy(asc(surfForecasts.timestamp));

	const allTides = await db
		.select()
		.from(tideForecasts)
		.where(
			and(
				eq(tideForecasts.spotId, selectedSpotId),
				gte(tideForecasts.timestamp, now),
			),
		)
		.orderBy(asc(tideForecasts.timestamp));

	// Group waves by source
	const surflineWaves = allWaves.filter((w) => w.source === "surfline");
	const swellcloudWaves = allWaves.filter((w) => w.source === "swellcloud");

	// Group forecasts by day for the forecast widget (next 5 days)
	const fiveDaysFromNow = new Date(now);
	fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

	const dailyForecasts: {
		date: string;
		dateObj: Date;
		surfline: {
			heightMin: number | null;
			heightMax: number | null;
			heightAvg: number | null;
			period: number | null;
			rating: string | null;
		};
		swellcloud: {
			heightMin: number | null;
			heightMax: number | null;
			heightAvg: number | null;
			period: number | null;
		};
	}[] = [];

	// Group by day
	const dayGroups = new Map<string, typeof allWaves>();
	for (const wave of allWaves) {
		if (wave.timestamp > fiveDaysFromNow) break;
		const dayKey = wave.timestamp.toISOString().split("T")[0];
		if (!dayGroups.has(dayKey)) {
			dayGroups.set(dayKey, []);
		}
		const dayGroup = dayGroups.get(dayKey);
		if (dayGroup) {
			dayGroup.push(wave);
		}
	}

	// Process each day
	for (const [dayKey, waves] of dayGroups.entries()) {
		const dayDate = new Date(`${dayKey}T00:00:00`);
		const daySurfline = waves.filter((w) => w.source === "surfline");
		const daySwellcloud = waves.filter((w) => w.source === "swellcloud");

		const surflineHeights = daySurfline
			.map((w) => {
				if (w.waveHeightMin && w.waveHeightMax) {
					return (w.waveHeightMin + w.waveHeightMax) / 2;
				}
				return null;
			})
			.filter((h): h is number => h !== null);

		const swellcloudHeights = daySwellcloud
			.map((w) => w.waveHeightMax)
			.filter((h): h is number => h !== null);

		const surflinePeriods = daySurfline
			.map((w) => w.wavePeriod)
			.filter((p): p is number => p !== null);

		const swellcloudPeriods = daySwellcloud
			.map((w) => w.wavePeriod)
			.filter((p): p is number => p !== null);

		dailyForecasts.push({
			date: dayKey,
			dateObj: dayDate,
			surfline: {
				heightMin:
					daySurfline.length > 0
						? Math.min(
								...daySurfline
									.map((w) => w.waveHeightMin)
									.filter((h): h is number => h !== null),
							)
						: null,
				heightMax:
					daySurfline.length > 0
						? Math.max(
								...daySurfline
									.map((w) => w.waveHeightMax)
									.filter((h): h is number => h !== null),
							)
						: null,
				heightAvg:
					surflineHeights.length > 0
						? surflineHeights.reduce((a, b) => a + b, 0) /
							surflineHeights.length
						: null,
				period:
					surflinePeriods.length > 0
						? surflinePeriods.reduce((a, b) => a + b, 0) /
							surflinePeriods.length
						: null,
				rating: daySurfline.find((w) => w.rating)?.rating || null,
			},
			swellcloud: {
				heightMin:
					swellcloudHeights.length > 0 ? Math.min(...swellcloudHeights) : null,
				heightMax:
					swellcloudHeights.length > 0 ? Math.max(...swellcloudHeights) : null,
				heightAvg:
					swellcloudHeights.length > 0
						? swellcloudHeights.reduce((a, b) => a + b, 0) /
							swellcloudHeights.length
						: null,
				period:
					swellcloudPeriods.length > 0
						? swellcloudPeriods.reduce((a, b) => a + b, 0) /
							swellcloudPeriods.length
						: null,
			},
		});
	}

	// Sort by date and limit to 5 days
	dailyForecasts.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
	const nextFiveDays = dailyForecasts.slice(0, 5);

	// Merge for comparison chart
	const combinedData: {
		timestamp: number;
		dateStr: string;
		surflineHeight: number | null;
		swellcloudHeight: number | null;
		surflinePeriod: number | null;
		swellcloudPeriod: number | null;
		rating: string | null;
	}[] = [];
	const timestamps = Array.from(
		new Set(allWaves.map((w) => w.timestamp.getTime())),
	).sort();

	for (const ts of timestamps) {
		const sWave = surflineWaves.find((w) => w.timestamp.getTime() === ts);
		const swWave = swellcloudWaves.find((w) => w.timestamp.getTime() === ts);
		if (sWave || swWave) {
			combinedData.push({
				timestamp: ts,
				dateStr: new Date(ts).toLocaleString([], {
					weekday: "short",
					hour: "numeric",
				}),
				surflineHeight: sWave
					? ((sWave.waveHeightMax ?? 0) + (sWave.waveHeightMin ?? 0)) / 2
					: null,
				swellcloudHeight: swWave ? swWave.waveHeightMax : null, // Swellcloud max=min in our fetcher
				surflinePeriod: sWave ? sWave.wavePeriod : null,
				swellcloudPeriod: swWave ? swWave.wavePeriod : null,
				rating: sWave ? sWave.rating : null,
			});
		}
	}

	return {
		combinedData,
		allTides,
		allSpots,
		selectedSpotId,
		selectedSpot: selectedSpot || null,
		dailyForecasts: nextFiveDays,
	};
};

const CHART_CONFIG = {
	surflineHeight: {
		label: "Surfline (ft)",
		color: "var(--chart-1)",
	},
	swellcloudHeight: {
		label: "Swellcloud (ft)",
		color: "var(--chart-2)",
	},
	surflinePeriod: {
		label: "Surfline Period (s)",
		color: "var(--chart-3)",
	},
	swellcloudPeriod: {
		label: "Swellcloud Period (s)",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

type DashboardData = Awaited<ReturnType<typeof loader>>;

export function SurfDashboardContent({
	data,
	onSpotChange,
}: {
	data: DashboardData;
	onSpotChange?: (value: string) => void;
}) {
	if (!data) return null;
	const {
		combinedData,
		allTides,
		allSpots,
		selectedSpotId,
		selectedSpot,
		dailyForecasts,
	} = data;

	const handleSpotChange = (value: string) => {
		if (onSpotChange) {
			onSpotChange(value);
		}
	};

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold tracking-tight">
						Surf Forecast Dashboard
					</h1>
					<p className="text-muted-foreground">
						{selectedSpot
							? `Comparing Surfline and Swellcloud data for ${selectedSpot.name}`
							: "Comparing Surfline and Swellcloud data"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Select Spot:</span>
					{allSpots.length > 0 ? (
						<Select value={selectedSpotId} onValueChange={handleSpotChange}>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="Select a spot" />
							</SelectTrigger>
							<SelectContent>
								{allSpots.map((spot) => (
									<SelectItem key={spot.id} value={spot.id}>
										{spot.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<span className="text-sm text-muted-foreground">
							No active spots
						</span>
					)}
				</div>
			</div>

			{combinedData.length === 0 && selectedSpot ? (
				<Card>
					<CardContent className="py-12">
						<div className="text-center text-muted-foreground">
							<p className="text-lg font-medium mb-2">
								No forecast data available
							</p>
							<p className="text-sm">
								No forecast data found for {selectedSpot.name}. Try syncing the
								spot from the admin panel.
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					{/* 5-Day Forecast Widget */}
					<Card className="col-span-1 md:col-span-2">
						<CardHeader>
							<CardTitle>5-Day Forecast</CardTitle>
							<CardDescription>
								Daily surf conditions for the next 5 days
							</CardDescription>
						</CardHeader>
						<CardContent>
							{dailyForecasts.length === 0 ? (
								<div className="text-center text-muted-foreground py-8">
									No forecast data available
								</div>
							) : (
								<div className="overflow-x-auto">
									<div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[600px]">
										{dailyForecasts.map((forecast) => {
											const isToday =
												forecast.dateObj.toDateString() ===
												new Date().toDateString();
											const dateLabel = isToday
												? "Today"
												: forecast.dateObj.toLocaleDateString([], {
														weekday: "short",
														month: "short",
														day: "numeric",
													});

											return (
												<div
													key={forecast.date}
													className={`border rounded-lg p-4 ${
														isToday
															? "border-primary bg-primary/5"
															: "border-border"
													}`}
												>
													<div className="text-sm font-semibold mb-3">
														{dateLabel}
													</div>
													<div className="space-y-3">
														{/* Surfline */}
														<div>
															<div className="text-xs text-muted-foreground mb-1">
																Surfline
															</div>
															{forecast.surfline.heightAvg !== null ? (
																<div className="space-y-1">
																	<div className="text-lg font-bold">
																		{forecast.surfline.heightMin !== null &&
																		forecast.surfline.heightMax !== null
																			? `${forecast.surfline.heightMin.toFixed(1)}-${forecast.surfline.heightMax.toFixed(1)} ft`
																			: `${forecast.surfline.heightAvg.toFixed(1)} ft`}
																	</div>
																	{forecast.surfline.period !== null && (
																		<div className="text-xs text-muted-foreground">
																			{forecast.surfline.period.toFixed(0)}s
																			period
																		</div>
																	)}
																	{forecast.surfline.rating && (
																		<div className="text-xs font-medium capitalize">
																			{forecast.surfline.rating.toLowerCase()}
																		</div>
																	)}
																</div>
															) : (
																<div className="text-sm text-muted-foreground">
																	No data
																</div>
															)}
														</div>

														{/* Swellcloud */}
														<div>
															<div className="text-xs text-muted-foreground mb-1">
																Swellcloud
															</div>
															{forecast.swellcloud.heightAvg !== null ? (
																<div className="space-y-1">
																	<div className="text-lg font-bold">
																		{forecast.swellcloud.heightMin !== null &&
																		forecast.swellcloud.heightMax !== null
																			? `${forecast.swellcloud.heightMin.toFixed(1)}-${forecast.swellcloud.heightMax.toFixed(1)} ft`
																			: `${forecast.swellcloud.heightAvg.toFixed(1)} ft`}
																	</div>
																	{forecast.swellcloud.period !== null && (
																		<div className="text-xs text-muted-foreground">
																			{forecast.swellcloud.period.toFixed(0)}s
																			period
																		</div>
																	)}
																</div>
															) : (
																<div className="text-sm text-muted-foreground">
																	No data
																</div>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Wave Height Comparison */}
						<Card className="col-span-1 md:col-span-2">
							<CardHeader>
								<CardTitle>Wave Height Comparison</CardTitle>
								<CardDescription>Average wave height in feet</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={CHART_CONFIG}
									className="min-h-[300px] w-full"
								>
									<LineChart accessibilityLayer data={combinedData}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="dateStr"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
										/>
										<YAxis tickLine={false} axisLine={false} unit="ft" />
										<ChartTooltip content={<ChartTooltipContent />} />
										<ChartLegend content={<ChartLegendContent />} />
										<Line
											type="monotone"
											dataKey="surflineHeight"
											stroke="var(--color-surflineHeight)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										<Line
											type="monotone"
											dataKey="swellcloudHeight"
											stroke="var(--color-swellcloudHeight)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
									</LineChart>
								</ChartContainer>
							</CardContent>
						</Card>

						{/* Wave Period Comparison */}
						<Card>
							<CardHeader>
								<CardTitle>Wave Period</CardTitle>
								<CardDescription>
									Primary swell period in seconds
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={CHART_CONFIG}
									className="min-h-[300px] w-full"
								>
									<LineChart accessibilityLayer data={combinedData}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="dateStr"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
										/>
										<YAxis tickLine={false} axisLine={false} unit="s" />
										<ChartTooltip content={<ChartTooltipContent />} />
										<ChartLegend content={<ChartLegendContent />} />
										<Line
											type="monotone"
											dataKey="surflinePeriod"
											stroke="var(--color-surflinePeriod)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										<Line
											type="monotone"
											dataKey="swellcloudPeriod"
											stroke="var(--color-swellcloudPeriod)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
									</LineChart>
								</ChartContainer>
							</CardContent>
						</Card>

						{/* Tide Chart */}
						<Card>
							<CardHeader>
								<CardTitle>Tide Forecast</CardTitle>
								<CardDescription>
									Predicted tide height (Surfline)
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={{
										height: {
											label: "Tide Height (ft)",
											color: "var(--chart-5)",
										},
									}}
									className="min-h-[300px] w-full"
								>
									<AreaChart
										accessibilityLayer
										data={allTides.map(
											(t: { timestamp: Date; height: number | null }) => ({
												dateStr: new Date(t.timestamp).toLocaleString([], {
													hour: "numeric",
												}),
												height: t.height,
											}),
										)}
									>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="dateStr"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
										/>
										<YAxis tickLine={false} axisLine={false} unit="ft" />
										<ChartTooltip content={<ChartTooltipContent />} />
										<Area
											type="monotone"
											dataKey="height"
											fill="var(--color-height)"
											fillOpacity={0.3}
											stroke="var(--color-height)"
										/>
									</AreaChart>
								</ChartContainer>
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}

export default function SurfDashboard() {
	const data = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const handleSpotChange = (value: string) => {
		const params = new URLSearchParams(searchParams);
		params.set("spotId", value);
		navigate(`?${params.toString()}`);
	};

	return <SurfDashboardContent data={data} onSpotChange={handleSpotChange} />;
}

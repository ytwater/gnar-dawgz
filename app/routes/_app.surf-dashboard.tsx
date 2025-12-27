import { and, asc, eq, gte } from "drizzle-orm";
import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ComposedChart,
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
import { Checkbox } from "~/app/components/ui/checkbox";
import { Label } from "~/app/components/ui/label";
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
		surflineWindSpeed: number | null;
		swellcloudWindSpeed: number | null;
		surflineWindDirection: number | null;
		swellcloudWindDirection: number | null;
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
				surflineWindSpeed: sWave ? sWave.windSpeed : null,
				swellcloudWindSpeed: swWave ? swWave.windSpeed : null,
				surflineWindDirection: sWave ? sWave.windDirection : null,
				swellcloudWindDirection: swWave ? swWave.windDirection : null,
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
		label: "Surfline Height (ft)",
		color: "var(--chart-1)",
	},
	swellcloudHeight: {
		label: "Swellcloud Height (ft)",
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
	surflineWindSpeed: {
		label: "Surfline Wind Speed (mph)",
		color: "var(--chart-5)",
	},
	swellcloudWindSpeed: {
		label: "Swellcloud Wind Speed (mph)",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

type DashboardData = Awaited<ReturnType<typeof loader>>;

function CustomTooltipContent({
	active,
	payload,
	label,
	showSurfline,
	showSwellcloud,
}: {
	active?: boolean;
	payload?: Array<{
		dataKey?: string;
		value?: number | string;
		name?: string;
		color?: string;
		payload?: Record<string, unknown>;
	}>;
	label?: string;
	showSurfline: boolean;
	showSwellcloud: boolean;
}) {
	if (!active || !payload?.length) return null;

	const data = payload[0]?.payload as
		| {
				surflineWindDirection?: number | null;
				swellcloudWindDirection?: number | null;
		  }
		| undefined;
	if (!data) return null;

	const getDirectionLabel = (degrees: number | null | undefined) => {
		if (degrees === null || degrees === undefined) return null;
		const directions = [
			"N",
			"NNE",
			"NE",
			"ENE",
			"E",
			"ESE",
			"SE",
			"SSE",
			"S",
			"SSW",
			"SW",
			"WSW",
			"W",
			"WNW",
			"NW",
			"NNW",
		];
		const index = Math.round(degrees / 22.5) % 16;
		return `${directions[index]} (${degrees.toFixed(0)}°)`;
	};

	return (
		<div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl">
			<div className="font-medium mb-2">{label}</div>
			<div className="space-y-1">
				{payload
					.filter((item) => item.value !== null && item.value !== undefined)
					.map((item) => {
						const nameStr = String(item.dataKey || item.name || "");
						const label =
							CHART_CONFIG[nameStr as keyof typeof CHART_CONFIG]?.label ||
							nameStr;
						const value =
							typeof item.value === "number"
								? item.value
								: Number.parseFloat(String(item.value));
						if (Number.isNaN(value)) return null;

						let displayValue = "";
						if (nameStr.includes("WindSpeed")) {
							displayValue = `${value.toFixed(1)} mph`;
						} else if (nameStr.includes("Height")) {
							displayValue = `${value.toFixed(1)} ft`;
						} else if (nameStr.includes("Period")) {
							displayValue = `${value.toFixed(0)}s`;
						} else {
							displayValue = value.toFixed(1);
						}

						return (
							<div key={item.dataKey} className="flex items-center gap-2">
								<div
									className="h-2 w-2 rounded-[2px]"
									style={{ backgroundColor: item.color }}
								/>
								<span className="text-muted-foreground">{label}:</span>
								<span className="font-mono font-medium">{displayValue}</span>
							</div>
						);
					})}
				{/* Wind Direction Info */}
				{(data.surflineWindDirection !== null ||
					data.swellcloudWindDirection !== null) && (
					<div className="pt-2 mt-2 border-t border-border/50">
						<div className="text-muted-foreground text-[10px] font-medium mb-1">
							Wind Direction:
						</div>
						{data.surflineWindDirection !== null && showSurfline && (
							<div className="text-[10px]">
								Surfline: {getDirectionLabel(data.surflineWindDirection)}
							</div>
						)}
						{data.swellcloudWindDirection !== null && showSwellcloud && (
							<div className="text-[10px]">
								Swellcloud: {getDirectionLabel(data.swellcloudWindDirection)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

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

	const [showSurfline, setShowSurfline] = useState(true);
	const [showSwellcloud, setShowSwellcloud] = useState(true);

	const handleSpotChange = (value: string) => {
		if (onSpotChange) {
			onSpotChange(value);
		}
	};

	// Filter data based on checkboxes
	const filteredData = combinedData.map((item) => ({
		...item,
		surflineHeight: showSurfline ? item.surflineHeight : null,
		surflinePeriod: showSurfline ? item.surflinePeriod : null,
		surflineWindSpeed: showSurfline ? item.surflineWindSpeed : null,
		swellcloudHeight: showSwellcloud ? item.swellcloudHeight : null,
		swellcloudPeriod: showSwellcloud ? item.swellcloudPeriod : null,
		swellcloudWindSpeed: showSwellcloud ? item.swellcloudWindSpeed : null,
	}));

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
						{/* Combined Wave Height, Period, and Wind Chart */}
						<Card className="col-span-1 md:col-span-2">
							<CardHeader>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
									<div>
										<CardTitle>Wave Height, Period & Wind</CardTitle>
										<CardDescription>
											Wave height (ft), period (s), and wind speed (mph)
										</CardDescription>
									</div>
									<div className="flex items-center gap-6">
										<div className="flex items-center gap-2">
											<Checkbox
												id="show-surfline"
												checked={showSurfline}
												onCheckedChange={(checked) =>
													setShowSurfline(checked === true)
												}
											/>
											<Label
												htmlFor="show-surfline"
												className="text-sm font-medium cursor-pointer"
											>
												Surfline
											</Label>
										</div>
										<div className="flex items-center gap-2">
											<Checkbox
												id="show-swellcloud"
												checked={showSwellcloud}
												onCheckedChange={(checked) =>
													setShowSwellcloud(checked === true)
												}
											/>
											<Label
												htmlFor="show-swellcloud"
												className="text-sm font-medium cursor-pointer"
											>
												Swellcloud
											</Label>
										</div>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={CHART_CONFIG}
									className="min-h-[400px] w-full"
								>
									<ComposedChart accessibilityLayer data={filteredData}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="dateStr"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
										/>
										<YAxis
											yAxisId="left"
											tickLine={false}
											axisLine={false}
											label={{
												value: "Height (ft) / Period (s)",
												angle: -90,
												position: "insideLeft",
											}}
										/>
										<YAxis
											yAxisId="right"
											orientation="right"
											tickLine={false}
											axisLine={false}
											label={{
												value: "Wind Speed (mph)",
												angle: 90,
												position: "insideRight",
											}}
										/>
										<ChartTooltip
											content={
												<CustomTooltipContent
													showSurfline={showSurfline}
													showSwellcloud={showSwellcloud}
												/>
											}
										/>
										<ChartLegend content={<ChartLegendContent />} />
										{/* Wave Heights */}
										<Line
											yAxisId="left"
											type="monotone"
											dataKey="surflineHeight"
											stroke="var(--color-surflineHeight)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										<Line
											yAxisId="left"
											type="monotone"
											dataKey="swellcloudHeight"
											stroke="var(--color-swellcloudHeight)"
											strokeWidth={2}
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										{/* Wave Periods */}
										<Line
											yAxisId="left"
											type="monotone"
											dataKey="surflinePeriod"
											stroke="var(--color-surflinePeriod)"
											strokeWidth={2}
											strokeDasharray="5 5"
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										<Line
											yAxisId="left"
											type="monotone"
											dataKey="swellcloudPeriod"
											stroke="var(--color-swellcloudPeriod)"
											strokeWidth={2}
											strokeDasharray="5 5"
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										{/* Wind Speeds */}
										<Line
											yAxisId="right"
											type="monotone"
											dataKey="surflineWindSpeed"
											stroke="var(--color-surflineWindSpeed)"
											strokeWidth={2}
											strokeDasharray="3 3"
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
										<Line
											yAxisId="right"
											type="monotone"
											dataKey="swellcloudWindSpeed"
											stroke="var(--color-swellcloudWindSpeed)"
											strokeWidth={2}
											strokeDasharray="3 3"
											dot={false}
											connectNulls={true}
											activeDot={{ r: 4 }}
										/>
									</ComposedChart>
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

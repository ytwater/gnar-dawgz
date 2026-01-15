import { HydrationBoundary } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ComposedChart,
	Line,
	Label as RechartsLabel,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import useLocalStorageState from "use-local-storage-state";
import { Button } from "~/app/components/ui/button";
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
import { Spinner } from "~/app/components/ui/spinner";
import {
	getActiveSpots,
	getDashboardData,
} from "~/app/lib/orpc/call-procedure";
import {
	surfForecastKeys,
	useActiveSpots,
	useDashboardData,
	useSyncSpot,
} from "~/app/lib/orpc/hooks/use-surf-forecast";
import {
	createQueryClient,
	dehydrateQueryClient,
} from "~/app/lib/orpc/query-client";
import {
	ADMIN_USER_IDS,
	SURFLINE_TORREY_PINES_SPOT_ID,
} from "../config/constants";
import { authClient } from "../lib/auth-client";
import { createORPCContext } from "../lib/orpc/server-helpers";

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
	console.log("context.cloudflare.env", context.cloudflare.env);
	const orpcContext = await createORPCContext(context.cloudflare.env, request);
	const url = new URL(request.url);
	console.log("LOADING SPOTS");
	// Get active spots via ORPC routes
	const allSpots = await getActiveSpots(orpcContext);

	// Determine default spot: try Torrey Pines by name or id, otherwise first active spot
	let defaultSpotId: string | null = null;
	const torreyPines = allSpots.find(
		(spot: (typeof allSpots)[number]) =>
			spot.id === SURFLINE_TORREY_PINES_SPOT_ID,
	);
	if (torreyPines) {
		defaultSpotId = torreyPines.id;
	} else if (allSpots.length > 0) {
		defaultSpotId = allSpots[0].id;
	}

	let selectedSpotId =
		url.searchParams.get("spotId") ||
		defaultSpotId ||
		SURFLINE_TORREY_PINES_SPOT_ID;

	// Validate that the selected spot exists and is active
	let selectedSpot = allSpots.find(
		(spot: (typeof allSpots)[number]) => spot.id === selectedSpotId,
	);
	if (!selectedSpot && defaultSpotId) {
		// Fall back to default if selected spot doesn't exist
		selectedSpotId = defaultSpotId;
		selectedSpot = allSpots.find(
			(spot: (typeof allSpots)[number]) => spot.id === selectedSpotId,
		);
	} else if (!selectedSpot && allSpots.length > 0) {
		// Fall back to first active spot if default doesn't exist
		selectedSpotId = allSpots[0].id;
		selectedSpot = allSpots[0];
	}

	// Get dashboard data via ORPC routes
	const dashboardData = await getDashboardData(orpcContext, selectedSpotId);

	// Create query client and pre-populate
	const queryClient = createQueryClient();
	queryClient.setQueryData(surfForecastKeys.activeSpots(), allSpots);
	queryClient.setQueryData(
		surfForecastKeys.dashboardData(selectedSpotId),
		dashboardData,
	);

	return {
		dehydratedState: dehydrateQueryClient(queryClient),
		selectedSpotId,
		selectedSpot: selectedSpot || null,
		allSpots,
		dashboardData,
		enableSurfline: context.cloudflare.env.ENABLE_SURFLINE !== "false",
		enableSwellCloud: context.cloudflare.env.ENABLE_SWELL_CLOUD !== "false",
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
	selectedSpotId,
	selectedSpot,
	onSpotChange,
	initialAllSpots,
	initialDashboardData,
	enableSurfline,
	enableSwellCloud,
}: {
	selectedSpotId: string;
	selectedSpot: { id: string; name: string; lastSyncedAt: Date | null } | null;
	onSpotChange?: (value: string) => void;
	initialAllSpots?: Awaited<ReturnType<typeof getActiveSpots>>;
	initialDashboardData?: Awaited<ReturnType<typeof getDashboardData>>;
	enableSurfline: boolean;
	enableSwellCloud: boolean;
}) {
	const { data: session } = authClient.useSession();
	const { data: allSpots } = useActiveSpots(initialAllSpots);
	const { data: dashboardData } = useDashboardData(
		selectedSpotId,
		initialDashboardData,
	);
	const syncSpotMutation = useSyncSpot();

	const hasMultipleSources = enableSurfline && enableSwellCloud;

	const currentUser = session?.user as
		| { id: string; role?: string }
		| undefined;
	const isAdmin =
		currentUser &&
		(currentUser.role === "admin" || ADMIN_USER_IDS.includes(currentUser.id));

	// Derive selectedSpot from allSpots so it updates when data refreshes
	const currentSelectedSpot =
		allSpots?.find((spot) => spot.id === selectedSpotId) || selectedSpot;

	if (!allSpots || !dashboardData) {
		return (
			<div className="container mx-auto py-8">
				<div className="text-center text-muted-foreground">Loading...</div>
			</div>
		);
	}

	const { combinedData, allTides, dailyForecasts } = dashboardData;

	const [showSurfline, setShowSurfline] = useLocalStorageState(
		"surf-dashboard-show-surfline",
		{
			defaultValue: true,
		},
	);
	const [showSwellcloud, setShowSwellcloud] = useLocalStorageState(
		"surf-dashboard-show-swellcloud",
		{
			defaultValue: true,
		},
	);

	const handleSpotChange = (value: string) => {
		if (onSpotChange) {
			onSpotChange(value);
		}
	};

	const handleSyncSpot = async () => {
		if (!selectedSpotId) return;
		try {
			await syncSpotMutation.mutateAsync(selectedSpotId);
		} catch (error) {
			console.error("Failed to sync spot:", error);
		}
	};

	// Filter data based on checkboxes
	const filteredData = combinedData.map((item) => ({
		...item,
		surflineHeight: enableSurfline && showSurfline ? item.surflineHeight : null,
		surflinePeriod: enableSurfline && showSurfline ? item.surflinePeriod : null,
		surflineWindSpeed:
			enableSurfline && showSurfline ? item.surflineWindSpeed : null,
		swellcloudHeight:
			enableSwellCloud && showSwellcloud ? item.swellcloudHeight : null,
		swellcloudPeriod:
			enableSwellCloud && showSwellcloud ? item.swellcloudPeriod : null,
		swellcloudWindSpeed:
			enableSwellCloud && showSwellcloud ? item.swellcloudWindSpeed : null,
	}));

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold tracking-tight">
						Surf Forecast Dashboard
					</h1>
					<p className="text-muted-foreground">
						{`Comparing Surfline and Swellcloud data for ${currentSelectedSpot?.name}`}
					</p>
					{currentSelectedSpot?.lastSyncedAt && (
						<p className="text-sm text-muted-foreground">
							Last updated at{" "}
							{currentSelectedSpot.lastSyncedAt.toLocaleString([], {
								month: "short",
								day: "numeric",
								year: "numeric",
								hour: "numeric",
								minute: "2-digit",
							})}
						</p>
					)}
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
					{isAdmin && selectedSpotId && (
						<Button
							variant="outline"
							size="icon"
							onClick={handleSyncSpot}
							disabled={syncSpotMutation.isPending}
							title="Refresh spot data"
						>
							{syncSpotMutation.isPending ? (
								<Spinner className="size-4" />
							) : (
								<RotateCw className="size-4" />
							)}
						</Button>
					)}
				</div>
			</div>

			{combinedData.length === 0 && currentSelectedSpot ? (
				<Card>
					<CardContent className="py-12">
						<div className="text-center text-muted-foreground">
							<p className="text-lg font-medium mb-2">
								No forecast data available
							</p>
							<p className="text-sm">
								No forecast data found for {currentSelectedSpot.name}. Try
								syncing the spot from the admin panel.
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
								<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
													{enableSurfline && (
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
													)}

													{/* Swellcloud */}
													{enableSwellCloud && (
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
													)}

													{/* Weather */}
													<div className="pt-2 border-t border-border/50">
														<div className="text-xs text-muted-foreground mb-1">
															Weather
														</div>
														{forecast.weather.temperature !== null ? (
															<div className="space-y-1">
																<div className="text-base font-semibold">
																	{forecast.weather.temperature.toFixed(0)}°F
																</div>
																{forecast.weather.precipitation !== null &&
																	forecast.weather.precipitation > 0 && (
																		<div className="text-xs text-muted-foreground">
																			{forecast.weather.precipitation.toFixed(
																				2,
																			)}
																			" rain
																		</div>
																	)}
																{forecast.weather.cloudCover !== null && (
																	<div className="text-xs text-muted-foreground">
																		{forecast.weather.cloudCover.toFixed(0)}%
																		clouds
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
										{hasMultipleSources && enableSurfline && (
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
										)}
										{hasMultipleSources && enableSwellCloud && (
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
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={Object.fromEntries(
										Object.entries(CHART_CONFIG).filter(([key]) => {
											if (key.startsWith("surfline")) return showSurfline;
											if (key.startsWith("swellcloud")) return showSwellcloud;
											return true;
										}),
									)}
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
										{showSurfline && (
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
										)}
										{showSwellcloud && (
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
										)}
										{/* Wave Periods */}
										{showSurfline && (
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
										)}
										{showSwellcloud && (
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
										)}
										{/* Wind Speeds */}
										{showSurfline && (
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
										)}
										{showSwellcloud && (
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
										)}
									</ComposedChart>
								</ChartContainer>
							</CardContent>
						</Card>

						{/* Tide Chart */}
						<Card>
							<CardHeader>
								<CardTitle>Tide Forecast</CardTitle>
								<CardDescription>
									Predicted tide height (Surfline) - Next 24 hours
								</CardDescription>
							</CardHeader>
							<CardContent>
								{(() => {
									const filteredTides = allTides.filter(
										(t: { timestamp: Date; height: number | null }) => {
											const now = new Date();
											const tideTime = new Date(t.timestamp);
											const hoursFromNow =
												(tideTime.getTime() - now.getTime()) / (1000 * 60 * 60);
											return hoursFromNow >= 0 && hoursFromNow <= 24;
										},
									);

									const tideData = filteredTides.map(
										(t: { timestamp: Date; height: number | null }) => ({
											dateStr: new Date(t.timestamp).toLocaleString([], {
												hour: "numeric",
											}),
											height: t.height,
											timestamp: t.timestamp,
										}),
									);

									// Find high and low tides (local maxima and minima)
									const highTides: Array<{
										dateStr: string;
										height: number;
										timestamp: Date;
									}> = [];
									const lowTides: Array<{
										dateStr: string;
										height: number;
										timestamp: Date;
									}> = [];

									for (let i = 1; i < tideData.length - 1; i++) {
										const prev = tideData[i - 1]?.height;
										const curr = tideData[i]?.height;
										const next = tideData[i + 1]?.height;

										if (prev !== null && curr !== null && next !== null) {
											// High tide: current is greater than both neighbors
											if (curr > prev && curr > next) {
												highTides.push({
													dateStr: tideData[i].dateStr,
													height: curr,
													timestamp: tideData[i].timestamp,
												});
											}
											// Low tide: current is less than both neighbors
											if (curr < prev && curr < next) {
												lowTides.push({
													dateStr: tideData[i].dateStr,
													height: curr,
													timestamp: tideData[i].timestamp,
												});
											}
										}
									}

									return (
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
												data={tideData}
												margin={{ top: 20, right: 10, bottom: 20, left: 10 }}
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
												{highTides.map((tide) => (
													<ReferenceLine
														key={`high-${tide.timestamp.getTime()}`}
														x={tide.dateStr}
														stroke="hsl(var(--chart-1))"
														strokeDasharray="2 2"
														strokeWidth={1.5}
														isFront={true}
													>
														<RechartsLabel
															value={`${tide.dateStr}\nH: ${tide.height.toFixed(1)}ft`}
															position="top"
															offset={10}
															className="fill-foreground text-xs"
														/>
													</ReferenceLine>
												))}
												{lowTides.map((tide) => (
													<ReferenceLine
														key={`low-${tide.timestamp.getTime()}`}
														x={tide.dateStr}
														stroke="hsl(var(--chart-2))"
														strokeDasharray="2 2"
														strokeWidth={1.5}
														isFront={true}
													>
														<RechartsLabel
															value={`${tide.dateStr}\nL: ${tide.height.toFixed(1)}ft`}
															position="bottom"
															offset={10}
															className="fill-foreground text-xs"
														/>
													</ReferenceLine>
												))}
											</AreaChart>
										</ChartContainer>
									);
								})()}
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}

export default function SurfDashboard() {
	const loaderData = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const handleSpotChange = (value: string) => {
		const params = new URLSearchParams(searchParams);
		params.set("spotId", value);
		navigate(`?${params.toString()}`);
	};

	return (
		<HydrationBoundary state={loaderData.dehydratedState}>
			<SurfDashboardContent
				selectedSpotId={loaderData.selectedSpotId}
				selectedSpot={loaderData.selectedSpot}
				onSpotChange={handleSpotChange}
				initialAllSpots={loaderData.allSpots}
				initialDashboardData={loaderData.dashboardData}
				enableSurfline={loaderData.enableSurfline}
				enableSwellCloud={loaderData.enableSwellCloud}
			/>
		</HydrationBoundary>
	);
}

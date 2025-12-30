import type { RouterClient } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpcClient } from "../client";
import type { AppRouter } from "../router";

type Client = RouterClient<AppRouter>;

export const surfForecastKeys = {
	all: ["surfForecast"] as const,
	activeSpots: () => [...surfForecastKeys.all, "activeSpots"] as const,
	forecasts: (spotId: string) =>
		[...surfForecastKeys.all, "forecasts", spotId] as const,
	dashboardData: (spotId: string) =>
		[...surfForecastKeys.all, "dashboardData", spotId] as const,
	spots: () => [...surfForecastKeys.all, "spots"] as const,
	taxonomy: (parentId?: string, search?: string) =>
		[
			...surfForecastKeys.all,
			"taxonomy",
			parentId || "all",
			search || "",
		] as const,
	taxonomyBreadcrumbs: (parentId: string) =>
		[...surfForecastKeys.all, "taxonomyBreadcrumbs", parentId] as const,
};

export function useActiveSpots(
	initialData?: Awaited<ReturnType<Client["surfForecast"]["getActiveSpots"]>>,
) {
	return useQuery<
		Awaited<ReturnType<Client["surfForecast"]["getActiveSpots"]>>,
		Error
	>({
		queryKey: surfForecastKeys.activeSpots(),
		queryFn: () => orpcClient.surfForecast.getActiveSpots(),
		initialData,
	});
}

export function useForecasts(spotId: string) {
	return useQuery({
		queryKey: surfForecastKeys.forecasts(spotId),
		queryFn: () => orpcClient.surfForecast.getForecasts({ spotId }),
		enabled: !!spotId,
	});
}

export function useDashboardData(
	spotId: string,
	initialData?: Awaited<ReturnType<Client["surfForecast"]["getDashboardData"]>>,
) {
	return useQuery<
		Awaited<ReturnType<Client["surfForecast"]["getDashboardData"]>>,
		Error
	>({
		queryKey: surfForecastKeys.dashboardData(spotId),
		queryFn: () => orpcClient.surfForecast.getDashboardData({ spotId }),
		enabled: !!spotId,
		initialData,
	});
}

export function useSpots() {
	return useQuery({
		queryKey: surfForecastKeys.spots(),
		queryFn: () => orpcClient.surfForecast.getSpots(),
	});
}

export function useTaxonomy(parentId?: string, search?: string) {
	return useQuery({
		queryKey: surfForecastKeys.taxonomy(parentId, search),
		queryFn: () =>
			orpcClient.surfForecast.getTaxonomy({
				parentId,
				search,
			}),
		enabled: !!(parentId || search),
	});
}

export function useTaxonomyBreadcrumbs(parentId: string) {
	return useQuery({
		queryKey: surfForecastKeys.taxonomyBreadcrumbs(parentId),
		queryFn: () => orpcClient.surfForecast.getTaxonomyBreadcrumbs({ parentId }),
		enabled: !!parentId,
	});
}

export function useSyncSpot() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (spotId: string) => orpcClient.surfForecast.syncSpot({ spotId }),
		onSuccess: (_, spotId) => {
			// Invalidate and refetch relevant queries to refresh data including lastSyncedAt
			queryClient.invalidateQueries({
				queryKey: surfForecastKeys.activeSpots(),
			});
			queryClient.refetchQueries({
				queryKey: surfForecastKeys.activeSpots(),
			});
			queryClient.invalidateQueries({
				queryKey: surfForecastKeys.dashboardData(spotId),
			});
			queryClient.refetchQueries({
				queryKey: surfForecastKeys.dashboardData(spotId),
			});
			queryClient.invalidateQueries({
				queryKey: surfForecastKeys.forecasts(spotId),
			});
		},
	});
}

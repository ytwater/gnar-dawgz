import type { RouterClient } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpcClient } from "../client";
import type { AppRouter } from "../router";

type Client = RouterClient<AppRouter>;

export type SurfReportData = Awaited<
	ReturnType<Client["surfReport"]["getSurfReport"]>
>;

export const surfReportKeys = {
	all: ["surfReport"] as const,
	report: (spotId: string) =>
		[...surfReportKeys.all, "report", spotId] as const,
};

export function useSurfReport(
	spotId: string,
	initialData?: SurfReportData,
) {
	return useQuery<SurfReportData, Error>({
		queryKey: surfReportKeys.report(spotId),
		queryFn: () => orpcClient.surfReport.getSurfReport({ spotId }),
		enabled: !!spotId,
		initialData,
		staleTime: 4 * 60 * 60 * 1000,
	});
}

export function useGenerateSurfReport() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (spotId: string) =>
			orpcClient.surfReport.generateSurfReport({ spotId }),
		onSuccess: (data, spotId) => {
			queryClient.setQueryData(surfReportKeys.report(spotId), data);
		},
	});
}

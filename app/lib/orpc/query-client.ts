import { QueryClient, dehydrate } from "@tanstack/react-query";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				refetchOnWindowFocus: false,
			},
		},
	});
}

export function dehydrateQueryClient(queryClient: QueryClient) {
	return dehydrate(queryClient);
}

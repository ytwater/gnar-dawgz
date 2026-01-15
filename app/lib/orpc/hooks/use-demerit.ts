import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "../client";

export const demeritKeys = {
	all: ["demerit"] as const,
	charter: () => [...demeritKeys.all, "charter"] as const,
	leaderboard: () => [...demeritKeys.all, "leaderboard"] as const,
};

export function useCharter() {
	return useQuery({
		queryKey: demeritKeys.charter(),
		queryFn: () => orpcClient.demerit.getCharter(),
	});
}

export function useLeaderboard() {
	return useQuery({
		queryKey: demeritKeys.leaderboard(),
		queryFn: () => orpcClient.demerit.getLeaderboard(),
	});
}

export function useUserDemerits() {
	return useQuery({
		queryKey: [...demeritKeys.all, "user"],
		queryFn: () => orpcClient.demerit.getUserDemerits(),
	});
}

export function useDemeritsByUserId(userId: string | undefined) {
	return useQuery({
		queryKey: [...demeritKeys.all, "user", userId],
		queryFn: () => {
			if (!userId) throw new Error("userId is required");
			return orpcClient.demerit.getDemeritsByUserId({ userId });
		},
		enabled: !!userId,
	});
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../auth-client";
import { orpcClient } from "../client";

export const profileImageKeys = {
	all: ["profileImage"] as const,
	list: () => [...profileImageKeys.all, "list"] as const,
	detail: (id: string) => [...profileImageKeys.all, "detail", id] as const,
};

export function useProfileImages() {
	return useQuery({
		queryKey: profileImageKeys.list(),
		queryFn: () => orpcClient.profileImage.list(),
	});
}

export function useProfileImage(id: string) {
	return useQuery({
		queryKey: profileImageKeys.detail(id),
		queryFn: () => orpcClient.profileImage.get({ id }),
		enabled: !!id,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === "pending" || status === "processing") {
				return 2000;
			}
			return false;
		},
	});
}

export function useUploadProfileImage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			imageData: string;
			fileName: string;
			mimeType: string;
		}) => orpcClient.profileImage.upload(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: profileImageKeys.list(),
			});
		},
	});
}

export function useGenerateProfileImage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			profileImageId: string;
			provider?: "openai" | "gemini";
			styleMode?: "head" | "full";
		}) => orpcClient.profileImage.generate(input),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: profileImageKeys.detail(variables.profileImageId),
			});
			queryClient.invalidateQueries({
				queryKey: profileImageKeys.list(),
			});
		},
	});
}

export function useSetActiveProfileImage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => orpcClient.profileImage.setActive({ id }),
		onSuccess: async () => {
			queryClient.invalidateQueries({
				queryKey: profileImageKeys.all,
			});
			// Refetch the session so the updated user.image is reflected
			await authClient.getSession({ query: { disableCookieCache: true } });
		},
	});
}

export function useDeleteProfileImage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => orpcClient.profileImage.delete({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: profileImageKeys.list(),
			});
		},
	});
}

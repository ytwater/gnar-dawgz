import { ArrowLeft, Dog, SpinnerGap, Upload } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import { Skeleton } from "~/app/components/ui/skeleton";
import {
	useGenerateProfileImage,
	useProfileImage,
	useSetActiveProfileImage,
	useUploadProfileImage,
} from "~/app/lib/orpc/hooks/use-profile-image";
import type { Route } from "./+types/_app.profile.creator";

type FlowState = "upload" | "provider-select" | "generating" | "review" | "error";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Create Your Gnar Dawg - Gnar Dawgs" },
		{
			name: "description",
			content: "Upload a photo of your dog and create a custom Gnar Dawg profile",
		},
	];
}

export default function ProfileCreator() {
	const [flowState, setFlowState] = useState<FlowState>("upload");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [profileImageId, setProfileImageId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadMutation = useUploadProfileImage();
	const generateMutation = useGenerateProfileImage();
	const setActiveMutation = useSetActiveProfileImage();

	const profileImageQuery = useProfileImage(profileImageId || "");

	// Poll for status changes during generation
	const profileImage = profileImageQuery.data;
	if (
		profileImage &&
		flowState === "generating" &&
		profileImage.status === "completed"
	) {
		setFlowState("review");
	} else if (
		profileImage &&
		flowState === "generating" &&
		profileImage.status === "failed"
	) {
		setErrorMessage(profileImage.errorMessage || "Generation failed");
		setFlowState("error");
	}

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setSelectedFile(file);
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
		},
		[],
	);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;

		setSelectedFile(file);
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
	}, []);

	const handleUpload = async () => {
		if (!selectedFile) return;

		try {
			const arrayBuffer = await selectedFile.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			let binary = "";
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const base64 = btoa(binary);

			const result = await uploadMutation.mutateAsync({
				imageData: base64,
				fileName: selectedFile.name,
				mimeType: selectedFile.type,
			});

			setProfileImageId(result.id);
			setFlowState("provider-select");
		} catch {
			toast.error("Failed to upload image");
		}
	};

	const handleGenerate = async (provider: "openai" | "gemini") => {
		if (!profileImageId) return;

		setFlowState("generating");
		try {
			await generateMutation.mutateAsync({
				profileImageId,
				provider,
			});
		} catch {
			// Error handled by polling — the mutation itself just kicks off the process
		}
	};

	const handleSetActive = async () => {
		if (!profileImageId) return;

		try {
			await setActiveMutation.mutateAsync(profileImageId);
			toast.success("Profile picture updated!");
		} catch {
			toast.error("Failed to set as profile picture");
		}
	};

	const handleReset = () => {
		setFlowState("upload");
		setSelectedFile(null);
		setPreviewUrl(null);
		setProfileImageId(null);
		setErrorMessage(null);
	};

	const handleGenerateAgain = () => {
		setFlowState("provider-select");
	};

	return (
		<div className="space-y-8 animate-in fade-in duration-500">
			<div className="flex items-center gap-4">
				<Link to="/profile">
					<Button variant="ghost" size="icon">
						<ArrowLeft className="w-5 h-5" />
					</Button>
				</Link>
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight">
						Create Your Gnar Dawg
					</h1>
					<p className="mt-2 text-muted-foreground">
						Upload a photo of your dog and we'll transform it into your own
						custom Gnar Dawgs profile in the style of our logo.
					</p>
				</div>
			</div>

			<div className="flex justify-center">
				<img
					src="/gnar-dawgs-logo-transparent.webp"
					alt="Gnar Dawgs Logo - Style Reference"
					className="h-48 w-auto"
				/>
			</div>

			{flowState === "upload" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Upload className="w-6 h-6" />
							Upload Your Dog's Photo
						</CardTitle>
						<CardDescription>
							Choose a clear photo of your dog. JPG, PNG, or WebP accepted.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div
							onClick={() => fileInputRef.current?.click()}
							onDrop={handleDrop}
							onDragOver={(e) => e.preventDefault()}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									fileInputRef.current?.click();
								}
							}}
							className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
						>
							{previewUrl ? (
								<img
									src={previewUrl}
									alt="Selected dog"
									className="mx-auto max-h-64 rounded-lg object-contain"
								/>
							) : (
								<div className="space-y-2">
									<Dog className="w-16 h-16 mx-auto text-muted-foreground" />
									<p className="text-muted-foreground">
										Click or drag & drop a photo of your dog
									</p>
								</div>
							)}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleFileSelect}
								className="hidden"
							/>
						</div>

						{selectedFile && (
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={handleReset}>
									Clear
								</Button>
								<Button
									onClick={handleUpload}
									disabled={uploadMutation.isPending}
								>
									{uploadMutation.isPending ? (
										<>
											<SpinnerGap className="w-4 h-4 animate-spin" />
											Uploading...
										</>
									) : (
										"Upload"
									)}
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{flowState === "provider-select" && (
				<Card>
					<CardHeader>
						<CardTitle>Choose AI Provider</CardTitle>
						<CardDescription>
							Select which AI model to use for generating your Gnar Dawg.
							You'll get two images: a standalone dog portrait and a full logo.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Button
								size="lg"
								className="h-auto py-6 flex-col gap-2"
								onClick={() => handleGenerate("openai")}
								disabled={generateMutation.isPending}
							>
								<span className="text-lg font-bold">OpenAI</span>
								<span className="text-sm opacity-80">GPT Image 1</span>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="h-auto py-6 flex-col gap-2"
								onClick={() => handleGenerate("gemini")}
								disabled={generateMutation.isPending}
							>
								<span className="text-lg font-bold">Gemini</span>
								<span className="text-sm opacity-80">Imagen 4</span>
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{flowState === "generating" && (
				<Card>
					<CardContent className="py-16">
						<div className="flex flex-col items-center gap-6">
							<SpinnerGap className="w-12 h-12 animate-spin text-primary" />
							<div className="text-center space-y-2">
								<p className="text-xl font-bold">
									Generating your Gnar Dawg...
								</p>
								<p className="text-muted-foreground">
									This may take a minute. We're creating your stylized portrait
									and full logo.
								</p>
							</div>
							{previewUrl && (
								<img
									src={previewUrl}
									alt="Your dog"
									className="max-h-48 rounded-lg object-contain opacity-60"
								/>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{flowState === "review" && profileImage && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Full Logo</CardTitle>
								<CardDescription>
									Your dog in the Gnar Dawgs logo
								</CardDescription>
							</CardHeader>
							<CardContent>
								{profileImage.fullLogoUrl ? (
									<img
										src={`/api/profile-image/${profileImage.fullLogoUrl}`}
										alt="Full logo with your dog"
										className="w-full rounded-lg"
									/>
								) : (
									<Skeleton className="w-full aspect-square rounded-lg" />
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Dog Portrait</CardTitle>
								<CardDescription>
									Standalone stylized portrait
								</CardDescription>
							</CardHeader>
							<CardContent>
								{profileImage.stylizedDogUrl ? (
									<img
										src={`/api/profile-image/${profileImage.stylizedDogUrl}`}
										alt="Stylized dog portrait"
										className="w-full rounded-lg"
									/>
								) : (
									<Skeleton className="w-full aspect-square rounded-lg" />
								)}
							</CardContent>
						</Card>
					</div>

					<div className="flex flex-wrap gap-3 justify-center">
						<Button
							onClick={handleSetActive}
							disabled={setActiveMutation.isPending}
						>
							{setActiveMutation.isPending
								? "Setting..."
								: "Set as Profile Picture"}
						</Button>
						<Button variant="outline" onClick={handleGenerateAgain}>
							Generate Again
						</Button>
						<Link to="/profile">
							<Button variant="ghost">Back to Profile</Button>
						</Link>
					</div>
				</div>
			)}

			{flowState === "error" && (
				<Card>
					<CardContent className="py-12">
						<div className="flex flex-col items-center gap-4 text-center">
							<p className="text-lg font-bold text-destructive">
								Something went wrong
							</p>
							<p className="text-muted-foreground">
								{errorMessage || "An error occurred during generation."}
							</p>
							<div className="flex gap-3">
								<Button onClick={handleGenerateAgain}>Try Again</Button>
								<Button variant="outline" onClick={handleReset}>
									Start Over
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

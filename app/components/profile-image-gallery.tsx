import {
	DownloadSimple,
	Eye,
	PaintBrush,
	Star,
	Trash,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/app/components/ui/alert-dialog";
import { Badge } from "~/app/components/ui/badge";
import { Button } from "~/app/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/app/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/app/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/app/components/ui/dropdown-menu";
import { Skeleton } from "~/app/components/ui/skeleton";
import {
	useDeleteProfileImage,
	useProfileImages,
	useSetActiveProfileImage,
} from "~/app/lib/orpc/hooks/use-profile-image";

export function ProfileImageGallery() {
	const { data: images, isLoading } = useProfileImages();
	const setActiveMutation = useSetActiveProfileImage();
	const deleteMutation = useDeleteProfileImage();
	const [viewingImage, setViewingImage] = useState<
		NonNullable<typeof images>[0] | null
	>(null);

	const handleSetActive = async (id: string) => {
		try {
			await setActiveMutation.mutateAsync(id);
			toast.success("Profile picture updated!");
		} catch {
			toast.error("Failed to set as profile picture");
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMutation.mutateAsync(id);
			toast.success("Image deleted");
		} catch {
			toast.error("Failed to delete image");
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<PaintBrush className="w-6 h-6" />
							Your Gnar Dawgs
						</CardTitle>
						<CardDescription>
							Custom profile images generated from your dog photos
						</CardDescription>
					</div>
					<Link to="/profile-creator">
						<Button>Create Your Gnar Dawg</Button>
					</Link>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						<Skeleton className="aspect-square rounded-lg" />
						<Skeleton className="aspect-square rounded-lg" />
					</div>
				) : !images || images.length === 0 ? (
					<div className="p-12 text-center text-muted-foreground">
						<p className="text-lg italic mb-4">
							You haven't created a Gnar Dawg yet!
						</p>
						<Link to="/profile-creator">
							<Button variant="outline">Get Started</Button>
						</Link>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						{images.map((image) => (
							<div key={image.id} className="relative group">
								<div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
									{image.status === "completed" && image.fullLogoUrl ? (
										<img
											src={`/api/profile-image/${image.fullLogoUrl}`}
											alt="Gnar Dawg Logo"
											className="w-full h-full object-cover"
										/>
									) : image.status === "processing" ||
										image.status === "pending" ? (
										<div className="w-full h-full flex items-center justify-center">
											<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
										</div>
									) : (
										<div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
											Failed
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														size="sm"
														variant="destructive"
														className="h-7"
														onClick={(e) => e.stopPropagation()}
													>
														<Trash className="w-4 h-4 mr-1" />
														Delete
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete failed image?</AlertDialogTitle>
														<AlertDialogDescription>
															This will remove the failed generation from your
															gallery. You can try again with a new photo.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() => handleDelete(image.id)}
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									)}

									{/* Badges overlay */}
									<div className="absolute top-2 left-2 flex gap-1">
										{image.isActive && (
											<Badge className="text-[10px]">
												<Star className="w-3 h-3 mr-1" weight="fill" />
												Active
											</Badge>
										)}
										<Badge variant="outline" className="text-[10px] bg-background/80">
											{image.provider}
										</Badge>
									</div>
								</div>

								{/* Date */}
								<p className="mt-1 text-[11px] text-muted-foreground text-center">
									{format(new Date(image.createdAt), "MMM d, yyyy")}
								</p>

								{/* Actions - visible on hover */}
								{image.status === "completed" && (
									<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
										{!image.isActive && (
											<Button
												size="icon"
												variant="secondary"
												onClick={() => handleSetActive(image.id)}
												title="Set as Profile Picture"
											>
												<Star className="w-4 h-4" />
											</Button>
										)}

										<Dialog>
											<DialogTrigger asChild>
												<Button
													size="icon"
													variant="secondary"
													onClick={() => setViewingImage(image)}
													title="View"
												>
													<Eye className="w-4 h-4" />
												</Button>
											</DialogTrigger>
											<DialogContent className="max-w-4xl">
												<DialogHeader>
													<DialogTitle>Your Gnar Dawg</DialogTitle>
												</DialogHeader>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													{image.fullLogoUrl && (
														<div>
															<p className="text-sm font-medium mb-2">
																Full Logo
															</p>
															<img
																src={`/api/profile-image/${image.fullLogoUrl}`}
																alt="Full logo"
																className="w-full rounded-lg"
															/>
														</div>
													)}
													{image.stylizedDogUrl && (
														<div>
															<p className="text-sm font-medium mb-2">
																Dog Portrait
															</p>
															<img
																src={`/api/profile-image/${image.stylizedDogUrl}`}
																alt="Dog portrait"
																className="w-full rounded-lg"
															/>
														</div>
													)}
												</div>
											</DialogContent>
										</Dialog>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													size="icon"
													variant="secondary"
													title="Download"
												>
													<DownloadSimple className="w-4 h-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent>
												{image.fullLogoUrl && (
													<DropdownMenuItem asChild>
														<a
															href={`/api/profile-image/${image.fullLogoUrl}`}
															download={`gnar-dawg-logo-${image.id}.png`}
														>
															Download Logo
														</a>
													</DropdownMenuItem>
												)}
												{image.stylizedDogUrl && (
													<DropdownMenuItem asChild>
														<a
															href={`/api/profile-image/${image.stylizedDogUrl}`}
															download={`gnar-dawg-portrait-${image.id}.png`}
														>
															Download Dog Portrait
														</a>
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>

										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													size="icon"
													variant="destructive"
													title="Delete"
												>
													<Trash className="w-4 h-4" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete this Gnar Dawg?</AlertDialogTitle>
													<AlertDialogDescription>
														This will permanently delete this generated image. This
														action cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => handleDelete(image.id)}
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

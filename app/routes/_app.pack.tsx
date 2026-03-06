import { Dog } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "~/app/components/ui/skeleton";
import { orpcClient } from "~/app/lib/orpc/client";
import type { Route } from "./+types/_app.pack";

const HEADERS: { tagline: string; sub: string }[] = [
	{
		tagline: "A ragtag crew of sun-soaked wave chasers, paddle warriors, and self-proclaimed ocean experts. We wipe out with style.",
		sub: "Gnar Dawgs SUP Club — where the vibes are immaculate and the falls are even better.",
	},
	{
		tagline: "San Diego's finest stand up paddle boarders. Emphasis on \"finest\" — nobody said anything about \"best.\"",
		sub: "Catch us at the Pound after every session, arguing about who almost caught the biggest wave.",
	},
	{
		tagline: "We paddle hard, fall harder, and eat more pizza than any surf crew has a right to.",
		sub: "Post-session debrief: mandatory. Location: the Dog Pound. Order: one large per person, no exceptions.",
	},
	{
		tagline: "Conquering the San Diego coastline one wobbly stand at a time.",
		sub: "The real treasure was the cold beers we drank at the Pound along the way.",
	},
	{
		tagline: "Born in the Pacific, raised on Pacific Beach vibes, fueled entirely by Pound pizza and questionable life choices.",
		sub: "SUP responsibly. Drink irresponsibly. Always tip your paddle.",
	},
	{
		tagline: "We showed up for the waves. We stayed for the pizza.",
		sub: "The Dog Pound is not just a restaurant — it's a state of mind.",
	},
	{
		tagline: "Not all who wander are lost. But some of us are definitely lost in the surf.",
		sub: "Post-session consensus: the waves were great, the wipeouts were spectacular, and the Pound never misses.",
	},
	{
		tagline: "A collection of humans who look at the Pacific Ocean and think \"yeah, I can stand on that.\"",
		sub: "Spoiler: sometimes we can. Meet us at the Pound either way.",
	},
	{
		tagline: "San Diego dawgs doing San Diego things — paddling at dawn, crushing slices by noon.",
		sub: "The Dog Pound holds a special place in our hearts. And our stomachs.",
	},
	{
		tagline: "We don't always ride the perfect wave, but we always find the perfect booth at the Pound.",
		sub: "Priorities are priorities.",
	},
	{
		tagline: "Equal parts ocean therapy and competitive pizza consumption.",
		sub: "Gnar Dawgs: San Diego's most dedicated crew of paddle enthusiasts and Pound regulars.",
	},
	{
		tagline: "The Pacific doesn't care how confident you looked on shore. Neither does the pizza — it'll eat with anyone.",
		sub: "See you at the Dog Pound. Wet hair welcome.",
	},
];

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "The Pack - Gnar Dawgs" },
		{
			name: "description",
			content: "Meet the Gnar Dawgs stand up paddle board crew",
		},
	];
}

type PackMember = {
	id: string;
	name: string;
	image: string | null;
	role: string | null;
};

const IGNORED_PREFIXES = ["Group", "system", "test"];

function shouldIgnore(name: string) {
	return IGNORED_PREFIXES.some((prefix) =>
		name.toLowerCase().startsWith(prefix.toLowerCase()),
	);
}

export default function Pack() {
	const [members, setMembers] = useState<PackMember[]>([]);
	const [loading, setLoading] = useState(true);
	const header = useMemo(
		() => HEADERS[Math.floor(Math.random() * HEADERS.length)],
		[],
	);

	useEffect(() => {
		orpcClient.users.listPackMembers()
			.then((data) => {
				setMembers(
					data.filter((u) => u.name && !shouldIgnore(u.name)),
				);
			})
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="space-y-10">
			<div className="text-center space-y-3 max-w-2xl mx-auto">
				<h1 className="text-5xl font-extrabold tracking-tight">The Pack</h1>
				<p className="text-xl text-muted-foreground">{header.tagline}</p>
				<p className="text-sm text-muted-foreground italic">{header.sub}</p>
			</div>

			{loading ? (
				<div className="flex flex-wrap justify-center gap-8">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="flex flex-col items-center gap-3">
							<Skeleton className="w-28 h-28 rounded-full" />
							<Skeleton className="h-4 w-20" />
						</div>
					))}
				</div>
			) : members.length === 0 ? (
				<div className="text-center py-20 text-muted-foreground text-lg">
					No pack members found. The dawgs must be out paddling.
				</div>
			) : (
				<div className="flex flex-wrap justify-center gap-8">
					{members.map((member) => (
						<div
							key={member.id}
							className="flex flex-col items-center gap-3 group"
						>
							<div className="w-28 h-28 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
								{member.image ? (
									<img
										src={member.image}
										alt={member.name}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-primary/10 flex items-center justify-center">
										<Dog
											weight="fill"
											className="w-16 h-16 text-primary/40"
										/>
									</div>
								)}
							</div>
							<span className="text-sm font-semibold text-center leading-tight max-w-[7rem]">
								{member.name}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

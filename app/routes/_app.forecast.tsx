import { useLoaderData } from "react-router";
import { fetchForecast, fetchSpotInfo } from "surfline";
import { Layout } from "~/app/components/layout";
import { SURFLINE_TORREY_PINES_SPOT_ID } from "~/app/config/constants";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../components/ui/card";

export const loader = async () => {
	const spotInfo = await fetchSpotInfo({
		spotIds: [SURFLINE_TORREY_PINES_SPOT_ID],
	});
	const forecast = await fetchForecast({
		spotId: SURFLINE_TORREY_PINES_SPOT_ID,
		type: "wave",
	});
	return { spotInfo, forecast };
};

export default function ForecastPage() {
	const { spotInfo, forecast } = useLoaderData();
	return (
		<Layout>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Spot Info</CardTitle>
					</CardHeader>
					<CardContent>
						<pre>{JSON.stringify(spotInfo, null, 2)}</pre>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Wave Forecast</CardTitle>
					</CardHeader>
					<CardContent>
						<pre>{JSON.stringify(forecast, null, 2)}</pre>
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}

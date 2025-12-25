export async function sendWhatsappTwilioResponse(
	from: string,
	message: string,
	env: CloudflareBindings,
) {
	const response = await fetch(
		`https://messaging.twilio.com/v1/Services/${env.TWILIO_SERVICE_SID}/Sessions/${sessionSid}/Messages`,
		{
			method: "POST",
			body: JSON.stringify({ from, message }),
		},
	);
	console.log(
		"🚀 ~ sendWhatsappTwilioResponse.ts:13 ~ sendWhatsappTwilioResponse ~ response:",
		response,
	);
}

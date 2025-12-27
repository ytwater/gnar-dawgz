/**
 * Manual implementation for Twilio Classic REST API Messages endpoint
 * POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *
 * This endpoint is not included in the generated API clients from orval.
 */

import { getTwilioAuthHeaders } from "./getTwilioAuthHeaders";

export interface CreateMessageBody {
	/** The destination phone number in E.164 format */
	To: string;
	/** The source phone number in E.164 format or alphanumeric sender ID */
	From: string;
	/** The text content of the message (up to 1,600 characters) */
	Body?: string;
	/** The SID of the Messaging Service to use */
	MessagingServiceSid?: string;
	/** URL to send status callbacks */
	StatusCallback?: string;
	/** HTTP method for status callback */
	StatusCallbackMethod?: string;
	/** Media URLs for MMS (comma-separated) */
	MediaUrl?: string | string[];
	/** Application SID for TwiML */
	ApplicationSid?: string;
	/** Maximum price to pay for the message */
	MaxPrice?: string;
	/** Whether to provide status callback */
	ProvideFeedback?: boolean;
	/** Attempt to detect and remove invalid characters */
	ValidityPeriod?: number;
	/** Force delivery from a specific number */
	ForceDelivery?: boolean;
	/** Smart encoding for special characters */
	SmartEncoded?: boolean;
	/** Persistent action for interactive messages */
	PersistentAction?: string | string[];
	/** Schedule message for future delivery (ISO 8601) */
	ScheduleType?: string;
	/** Time to send the message (ISO 8601) */
	SendAt?: string;
	/** Time to expire the message (ISO 8601) */
	SendAsMms?: boolean;
	/** Content variables for template messages */
	ContentSid?: string;
	/** Content variables for template messages */
	ContentVariables?: string;
}

export interface MessageResponse {
	/** The unique identifier for the message */
	sid: string;
	/** The date the message was created */
	date_created: string;
	/** The date the message was last updated */
	date_updated: string;
	/** The date the message was sent */
	date_sent: string | null;
	/** The account SID that owns the message */
	account_sid: string;
	/** The phone number that sent the message */
	from: string;
	/** The phone number that received the message */
	to: string;
	/** The body of the message */
	body: string;
	/** The status of the message */
	status:
		| "queued"
		| "sending"
		| "sent"
		| "failed"
		| "delivered"
		| "undelivered"
		| "receiving"
		| "received"
		| "accepted"
		| "scheduled"
		| "read"
		| "partially_delivered"
		| "canceled";
	/** The number of segments */
	num_segments: string;
	/** The number of media items */
	num_media: string;
	/** The direction of the message */
	direction: "inbound" | "outbound-api" | "outbound-call" | "outbound-reply";
	/** The API version used */
	api_version: string;
	/** The price of the message */
	price: string | null;
	/** The currency of the price */
	price_unit: string | null;
	/** Error code if message failed */
	error_code: number | null;
	/** Error message if message failed */
	error_message: string | null;
	/** URI for the message */
	uri: string;
	/** Subresource URIs */
	subresource_uris: {
		media?: string;
		feedback?: string;
	};
	/** Messaging Service SID if used */
	messaging_service_sid?: string | null;
}

export type CreateMessageResponse = {
	data: MessageResponse;
	status: number;
	headers: Headers;
};

export const getCreateMessageUrl = (accountSid: string): string => {
	return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
};

export const createMessage = async (
	env: CloudflareBindings,
	createMessageBody: CreateMessageBody,
): Promise<CreateMessageResponse> => {
	const accountSid = env.TWILIO_ACCOUNT_SID;
	const formUrlEncoded = new URLSearchParams();

	const headers = getTwilioAuthHeaders(env);

	const options = { method: "POST", headers };
	// console.log(
	// 	"🚀 ~ classic-messages-api.ts:130 ~ createMessage ~ options:",
	// 	options,
	// );

	// Required fields
	formUrlEncoded.append("To", createMessageBody.To);
	formUrlEncoded.append("From", createMessageBody.From);

	// Optional fields
	if (createMessageBody.Body !== undefined) {
		formUrlEncoded.append("Body", createMessageBody.Body);
	}
	if (createMessageBody.MessagingServiceSid !== undefined) {
		formUrlEncoded.append(
			"MessagingServiceSid",
			createMessageBody.MessagingServiceSid,
		);
	}
	if (createMessageBody.StatusCallback !== undefined) {
		formUrlEncoded.append("StatusCallback", createMessageBody.StatusCallback);
	}
	if (createMessageBody.StatusCallbackMethod !== undefined) {
		formUrlEncoded.append(
			"StatusCallbackMethod",
			createMessageBody.StatusCallbackMethod,
		);
	}
	if (createMessageBody.MediaUrl !== undefined) {
		if (Array.isArray(createMessageBody.MediaUrl)) {
			for (const url of createMessageBody.MediaUrl) {
				formUrlEncoded.append("MediaUrl", url);
			}
		} else {
			formUrlEncoded.append("MediaUrl", createMessageBody.MediaUrl);
		}
	}
	if (createMessageBody.ApplicationSid !== undefined) {
		formUrlEncoded.append("ApplicationSid", createMessageBody.ApplicationSid);
	}
	if (createMessageBody.MaxPrice !== undefined) {
		formUrlEncoded.append("MaxPrice", createMessageBody.MaxPrice);
	}
	if (createMessageBody.ProvideFeedback !== undefined) {
		formUrlEncoded.append(
			"ProvideFeedback",
			createMessageBody.ProvideFeedback.toString(),
		);
	}
	if (createMessageBody.ValidityPeriod !== undefined) {
		formUrlEncoded.append(
			"ValidityPeriod",
			createMessageBody.ValidityPeriod.toString(),
		);
	}
	if (createMessageBody.ForceDelivery !== undefined) {
		formUrlEncoded.append(
			"ForceDelivery",
			createMessageBody.ForceDelivery.toString(),
		);
	}
	if (createMessageBody.SmartEncoded !== undefined) {
		formUrlEncoded.append(
			"SmartEncoded",
			createMessageBody.SmartEncoded.toString(),
		);
	}
	if (createMessageBody.PersistentAction !== undefined) {
		if (Array.isArray(createMessageBody.PersistentAction)) {
			for (const action of createMessageBody.PersistentAction) {
				formUrlEncoded.append("PersistentAction", action);
			}
		} else {
			formUrlEncoded.append(
				"PersistentAction",
				createMessageBody.PersistentAction,
			);
		}
	}
	if (createMessageBody.ScheduleType !== undefined) {
		formUrlEncoded.append("ScheduleType", createMessageBody.ScheduleType);
	}
	if (createMessageBody.SendAt !== undefined) {
		formUrlEncoded.append("SendAt", createMessageBody.SendAt);
	}
	if (createMessageBody.SendAsMms !== undefined) {
		formUrlEncoded.append("SendAsMms", createMessageBody.SendAsMms.toString());
	}
	if (createMessageBody.ContentSid !== undefined) {
		formUrlEncoded.append("ContentSid", createMessageBody.ContentSid);
	}
	if (createMessageBody.ContentVariables !== undefined) {
		formUrlEncoded.append(
			"ContentVariables",
			createMessageBody.ContentVariables,
		);
	}

	const res = await fetch(getCreateMessageUrl(accountSid), {
		...options,
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			...options?.headers,
		},
		body: formUrlEncoded,
	});

	const body = [204, 205, 304].includes(res.status) ? null : await res.text();

	const data: CreateMessageResponse["data"] = body ? JSON.parse(body) : {};
	return {
		data,
		status: res.status,
		headers: res.headers,
	} as CreateMessageResponse;
};

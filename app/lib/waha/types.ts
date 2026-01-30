/**
 * WAHA Webhook Event Types
 * Based on WAHA Documentation: https://waha.devlike.pro/docs/how-to/events/
 */

export type WahaEventName =
	| "message"
	| "message.any"
	| "message.ack"
	| "message.edited"
	| "message.revoked"
	| "session.status"
	| "group.upsert"
	| "group.update"
	| string;

export interface WahaContact {
	id: string;
	pushName?: string;
}

export interface WahaMessagePayload {
	id: string;
	timestamp: number;
	from: string;
	fromMe: boolean;
	to: string;
	body: string;
	hasMedia: boolean;
	participant?: string; // Present in group chats
	source?: "app" | "api";
	_data?: unknown;
}

export interface WahaEvent<T = unknown> {
	id: string;
	timestamp: number;
	event: WahaEventName;
	session: string;
	metadata?: Record<string, string>;
	me?: WahaContact;
	payload: T;
	engine: string;
	environment: {
		tier: string;
		version: string;
	};
}

export type WahaMessageEvent = WahaEvent<WahaMessagePayload>;

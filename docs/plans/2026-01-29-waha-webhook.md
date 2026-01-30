# WAHA Webhook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement a webhook handler for WAHA (WhatsApp HTTP API) to receive and respond to WhatsApp messages, with specific logic for group chats (conditional response) and one-on-one chats (always respond).

**Architecture:** 
We will create a new API route `app/routes/api.waha.webhook.ts` to receive WAHA events.
We will implement a `handleWahaEvent` function that:
1.  Normalizes user/group identity (mapping WAHA IDs to our `users` table).
2.  For group messages, uses a lightweight AI check to decide if the bot should respond.
3.  For one-on-one messages, always responds.
4.  Reuses the existing `WhatsAppAgent` class for generating responses.
5.  Sends the response back using WAHA's API.

**Tech Stack:** Cloudflare Workers, WAHA, TypeScript, Drizzle ORM, AI SDK.

---

### Task 1: Define WAHA Types and Client

Create types for WAHA events and a client to send messages.

**Files:**
- Create: `app/lib/waha/types.ts`
- Create: `app/lib/waha/client.ts`

**Step 1: Define Types**
Create `app/lib/waha/types.ts` with interfaces for WAHA events (Message, SessionStatus) and payloads based on documentation.

**Step 2: Create Client**
Create `app/lib/waha/client.ts` with `sendWahaMessage` function.
It should take `chatId` (e.g. `number@c.us` or `group@g.us`) and `text`.
It needs `WAHA_API_URL` (or internal URL if running sidecar) and `WAHA_SESSION_ID` from env.
*Note: In `wrangler.json`, `WAHA_SESSION_ID` is present. We assume WAHA is accessible via HTTP.*
*Function must handle `fetch` to WAHA endpoint (usually `/api/sendText`).*

### Task 2: Implement Event Handling Logic

Core logic to process incoming messages, handle users/groups, and decide responses.

**Files:**
- Create: `app/lib/waha/handle-event.ts`
- Modify: `app/lib/chat/handleIncomingMessage.ts` (optional integration, but we'll keep separate for now to avoid breaking Twilio)

**Step 1: User/Group Resolution**
Implement logic to look up `users` by `phoneNumber` (WAHA ID).
If it's a group (ends in `@g.us`), treat the group as a User? Or create a User for the group?
*Decision:* Create a User with `phoneNumber` = group ID and `name` = "Group " + ID (or fetch group name if available). This allows `WhatsAppAgent` to load history for the group.

**Step 2: "Should Reply" Logic**
Implement `shouldReplyToGroup(text: string, env: CloudflareBindings)` helper.
- If the bot is directly mentioned (e.g. contains "@bot" or its configured name/number), it **MUST** always respond.
- Otherwise, use `generateText` with a small model (or same model) to classify if the message is relevant (surf forecast, demerits, etc.).
*Prompt:* "Analyze this message from a WhatsApp group. Is it asking for a surf forecast, managing demerits, or directly addressing the bot? Reply 'YES' or 'NO'."
*Note:* The "always response if mentioned" logic should be checked before the AI classification to save tokens and ensure reliability.

**Step 3: Handler Function**
`handleWahaEvent(event, env)`:
- Extract `from`, `body`, `participant` (if group).
- If Group:
    - Run `shouldReplyToGroup`.
    - If NO, return.
- Ensure User exists in DB (Group or Person).
- Instantiate `WhatsAppAgent`.
- Call `agent.onMessage`.
- Send response via `sendWahaMessage`.

### Task 3: Create Webhook Endpoint

The entry point for WAHA webhooks.

**Files:**
- Create: `app/routes/api.waha.webhook.ts`

**Step 1: Route Setup**
Implement `action` handler.
- Read request body.
- Verify it's a `message` event.
- Call `handleWahaEvent` (using `ctx.waitUntil` or just await if fast enough).
*Note: We will await it for now. If it's too slow, we might need to use the Queue, but that requires updating the Queue consumer to handle WAHA events. For this MVP, direct processing or `ctx.waitUntil` is preferred.*

**Step 2: Response**
Return 200 OK to WAHA immediately (if using `waitUntil`) or after processing.

### Task 4: Verify and Test

**Files:**
- Test: `app/routes/api.waha.webhook.test.ts` (if possible to mock)

**Verification:**
- Simulate a generic WAHA payload.
- Verify `sendWahaMessage` is called.

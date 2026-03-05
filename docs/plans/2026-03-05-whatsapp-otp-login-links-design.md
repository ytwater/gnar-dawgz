# WhatsApp OTP Login Links Design

## Problem

When the WhatsApp agent suggests visiting gnardawgs.surf pages (e.g., `/profile-creator`), users land on a page that requires authentication. They must manually navigate to `/login`, enter their phone number, wait for an OTP, and then find the page again. This is too much friction.

## Solution

Automatically rewrite any `gnardawgs.surf` URL in the agent's WhatsApp responses into a magic login link that includes an OTP. When the user taps the link, they are logged in and redirected to the destination page in one step.

## Design

### 1. URL Rewriting (Post-Processing)

**New file:** `app/lib/waha/rewrite-urls.ts`

After the WhatsApp agent generates a response, scan for `gnardawgs.surf` URLs and rewrite them with OTP login params.

```
Input:  "Create your profile at https://www.gnardawgs.surf/profile-creator"
Output: "Create your profile at https://www.gnardawgs.surf/login?phone=1234567890&code=847291&redirectTo=%2Fprofile-creator"
```

Logic:
- Regex match all `https://www.gnardawgs.surf/...` URLs in response text
- Extract the path from each URL (e.g., `/profile-creator`)
- Skip URLs that already point to `/login`
- Generate one 6-digit OTP code, store in `verifications` table with 5-min expiry
- Rewrite each URL to `/login?phone={phone}&code={code}&redirectTo={path}`
- Reuse the same OTP for all URLs in one message

### 2. Server-Side Auth Check in Login Route

**Modified file:** `app/routes/_app_.login.tsx`

Add a route loader that checks for an existing session:
- If session exists and `redirectTo` param present: redirect to destination
- If session exists, no `redirectTo`: redirect to `/`
- If no session: render login page normally

This ensures logged-in users clicking any OTP link (including stale ones) go straight to the destination without seeing the login page.

### 3. Expired OTP Handling

**Modified file:** `app/routes/_app_.login.tsx`

When auto-submit fails (expired/invalid code):
- Show phone number pre-filled and disabled
- Display "This link has expired" message
- Show "Send New Code" button that triggers `authClient.phoneNumber.sendOtp()`
- After sending, show OTP input field for the new code
- Preserve `redirectTo` param throughout the flow

### Integration Points

**`app/lib/waha/handle-event.ts`:**
- After `agent.onMessage()` returns, call `rewriteUrlsWithOtp()` before `sendWahaMessage()`
- Refactor existing group-chat login flow (lines 264-291) to use the same utility

### Edge Cases

| Scenario | Behavior |
|---|---|
| Already logged in + any OTP link | Server-side redirect to destination |
| Not logged in + valid OTP | Auto-submit, login, redirect |
| Not logged in + expired OTP | "Link expired" + "Send New Code" button |
| URL with no path (just domain) | `redirectTo=/` |
| Multiple URLs in one message | One OTP shared, each URL gets own `redirectTo` |
| `/login` URL in response | Skip rewriting |

### Files Changed

1. `app/lib/waha/rewrite-urls.ts` — new, URL rewriting function
2. `app/lib/waha/handle-event.ts` — integrate rewriting after agent response
3. `app/routes/_app_.login.tsx` — add loader + expired OTP UX

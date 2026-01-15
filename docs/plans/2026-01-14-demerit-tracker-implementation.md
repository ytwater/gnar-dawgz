# Demerit Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a demerit tracking system for Gnar Dawgs members to handle charter violations via WhatsApp and clear them via beer-buying on the website.

**Architecture:** Single-bot architecture using the existing `WhatsAppAgent` with new AI tools. Data is stored in Drizzle/D1.

**Tech Stack:** React Router, Cloudflare D1/KV, Drizzle ORM, Better-Auth, DeepSeek AI.

---

## Proposed Changes

### Database Schema

#### [MODIFY] [app-schema.ts](file:///home/ytwat/workspace/gd/gnar-dawgs/app/lib/app-schema.ts)
- Add `charter` table.
- Add `demerits` table.
- Export both from `app-schema.ts`.

### WhatsApp Chatbot

#### [NEW] [createAssignDemeritTool.ts](file:///home/ytwat/workspace/gd/gnar-dawgs/workers/tools/createAssignDemeritTool.ts)
- Implement AI tool to find user by name and create a demerit.

#### [NEW] [createClearDemeritsTool.ts](file:///home/ytwat/workspace/gd/gnar-dawgs/workers/tools/createClearDemeritsTool.ts)
- Implement AI tool to clear active demerits for a user.

#### [NEW] [createGetCharterTool.ts](file:///home/ytwat/workspace/gd/gnar-dawgs/workers/tools/createGetCharterTool.ts)
- Implement AI tool to fetch the current charter content.

#### [MODIFY] [whatsapp-agent.ts](file:///home/ytwat/workspace/gd/gnar-dawgs/workers/whatsapp-agent.ts)
- Import and register the new tools in `WhatsAppAgent`.
- Update system prompt to include demerit tracking instructions.

### Web Application

#### [NEW] [_app.charter.tsx](file:///home/ytwat/workspace/gd/gnar-dawgs/app/routes/_app.charter.tsx)
- Public (member-only) route to view the charter and leaderboard.

#### [NEW] [admin.charter.tsx](file:///home/ytwat/workspace/gd/gnar-dawgs/app/routes/admin.charter.tsx)
- Admin route to edit the charter.

#### [MODIFY] [_app.profile.tsx](file:///home/ytwat/workspace/gd/gnar-dawgs/app/routes/_app.profile.tsx)
- Add "Demerit History" section to the user profile.

---

## Verification Plan

### Automated Tests
- I will create a new test script `scripts/test-demerit-logic.ts` to verify the Drizzle queries for assigning and clearing demerits.
  - Run: `npx tsx scripts/test-demerit-logic.ts`
  - Expected: Database records are created and updated correctly.

### Manual Verification
1.  **WhatsApp Simulation**: I will use the `WhatsAppAgent` directly in a script to simulate messages:
    - Message: "Alex was late to surf, give him a demerit."
    - Expected: AI calls `assignDemerit` and confirms.
    - Message: "I bought a beer for Alex."
    - Expected: AI calls `clearDemerits` and confirms.
2.  **Web UI**:
    - Login and navigate to `/charter`. Verify it shows the charter and leaderboard.
    - Go to `/admin/charter`, edit the text, and save. Verify the update on `/charter`.
    - Check user profile at `/profile` to see the demerit history.

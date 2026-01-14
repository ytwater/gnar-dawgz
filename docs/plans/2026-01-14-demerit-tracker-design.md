# Demerit Tracker Design

This document outlines the technical design for adding a demerit tracking system to the Gnar Dawgs website and WhatsApp chatbot.

## Overview
A system where members can assign "demerits" to each other via WhatsApp for violating the "Global Charter". Demerits are cleared when a member buys a beer for the affected party.

## Data Model

### `charter` Table
Stores the content of the global charter.
- `id`: text (PK)
- `content`: text (Markdown)
- `updatedAt`: integer (timestamp)
- `updatedBy`: text (references users.id)

### `demerits` Table
Tracks individual demerits.
- `id`: text (PK)
- `fromUserId`: text (references users.id)
- `toUserId`: text (references users.id)
- `reason`: text
- `status`: text ('active' | 'cleared')
- `createdAt`: integer (timestamp)
- `clearedAt`: integer (timestamp, null until cleared)

## WhatsApp Interaction

A single bot architecture (`WhatsAppAgent`) will handle both surf reports and demerits using the following AI tools:

1.  **`assignDemerit(targetUser: string, reason: string)`**:
    - Finds the user by name/mention.
    - Creates an 'active' demerit record.
2.  **`clearDemerits(recipientUser: string)`**:
    - Marks all active demerits for the user as 'cleared' (triggered by messages like "I bought a beer for Alex").
3.  **`getCharter()`**:
    - Allows the AI to reference the latest charter text.

## Web Application

### Access Control
- `/charter` and member profiles are restricted to **logged-in users**.
- `/admin/charter` is restricted to **admins**.

### Features
1.  **Charter Page (`/charter`)**:
    - Displays the Markdown charter.
    - Includes a "Demerit Leaderboard" sorted by most active demerits.
2.  **Admin Editor (`/admin/charter`)**:
    - Interface to edit and save the charter content.
3.  **Profile Integration**:
    - User profiles will show their "Demerit History" (issued and received).

## Implementation Steps
1. Update schema with `demerits` and `charter` tables.
2. Implement WhatsApp AI tools and update `WhatsAppAgent` prompt.
3. Create `/charter` route and leaderboard.
4. Create `/admin/charter` editor.
5. Add Demerit History to profile pages.

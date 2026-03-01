# Gnar Dawg Profile Creator — Design

## Overview

Users upload a photo of their dog and the system generates two custom images in the style of the Gnar Dawgs logo:

1. **Full Logo** — The stylized dog composited into the logo template (wave, SUP board, paddle, "GNAR DAWGS" text)
2. **Standalone Dog Portrait** — Just the dog rendered in the logo's illustrated art style, transparent background

Users can create as many as they want and set any completed image as their active profile picture.

## Architecture

### Tech Stack

- **AI Image Generation** — Provider-agnostic adapter supporting **OpenAI GPT Image 1.5** and **Google Gemini Imagen 4** for A/B testing
- **Storage** — Cloudflare R2 bucket (`gnar-dawgs-profiles`)
- **Database** — New `profile_images` table in D1 (via Drizzle)
- **API** — New ORPC router for profile image management
- **Frontend** — New `/profile/creator` route + gallery on existing `/profile` page

### Data Flow

```
Upload dog photo → Store original in R2
  → Step 1: AI generates stylized dog illustration → Store in R2
  → Step 2: AI composites stylized dog into logo template → Store in R2
  → Save all 3 URLs + metadata (including provider) to DB
  → User reviews & optionally sets as profile picture
```

### Generation Approach — Two-Step

**Step 1 — Stylized Dog:**
- Input: User's dog photo + original Gnar Dawgs logo as style reference
- Prompt describes the illustrated/vector art style — bold outlines, rich colors, detailed fur rendering
- Output: Just the dog, transparent background, matching the logo's art style

**Step 2 — Logo Compositing:**
- Input: Stylized dog from Step 1 + original Gnar Dawgs logo as reference
- Prompt instructs the model to place the stylized dog into the logo composition
- Output: Complete logo with the user's dog, transparent outer background

Generation runs inline (no queues) — low traffic private site. Frontend polls status.

## Provider Adapter

```typescript
interface ImageGenerationProvider {
  generateStylizedDog(originalImage: Buffer, referenceImage: Buffer): Promise<Buffer>
  compositeIntoLogo(stylizedDog: Buffer, referenceImage: Buffer): Promise<Buffer>
}
```

- Implementations for OpenAI (GPT Image 1.5) and Gemini (Imagen 4)
- Provider selection via environment variable `IMAGE_PROVIDER=openai|gemini`
- Provider recorded per generation for A/B comparison
- Both can be active simultaneously

## Database Schema

```sql
CREATE TABLE profile_images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  original_url TEXT NOT NULL,
  stylized_dog_url TEXT,
  full_logo_url TEXT,
  provider TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

- `stylized_dog_url` and `full_logo_url` nullable — populated after generation completes
- `is_active` — only one per user at a time; setting new active clears previous
- `status` — `pending` | `processing` | `completed` | `failed`
- When set as active, `users.image` also updated to `stylized_dog_url`

## R2 Storage Structure

**Bucket:** `gnar-dawgs-profiles`

```
profiles/
  {user_id}/
    {profile_image_id}/
      original.png
      stylized-dog.png
      full-logo.png
```

- All images stored as PNG (lossless, transparency support, native AI output format)
- Upload handled server-side — frontend sends photo to API, Worker stores in R2

## API Routes (ORPC)

```
POST   /api/orpc/profile-image.upload      -- Upload dog photo, store in R2, create DB record
POST   /api/orpc/profile-image.generate     -- Kick off AI generation (profile_image_id + provider)
GET    /api/orpc/profile-image.list         -- List all user's generated profile images
GET    /api/orpc/profile-image.get          -- Get single profile image by ID
POST   /api/orpc/profile-image.setActive    -- Set a completed image as active profile pic
DELETE /api/orpc/profile-image.delete       -- Delete a profile image + R2 files
```

All routes require authentication. Users can only access their own images.

## Frontend

### Profile Creator (`/profile/creator`)

**Hero/intro section:**
- Heading: "Create Your Gnar Dawg"
- Body: "Upload a photo of your dog and we'll transform it into your own custom Gnar Dawgs profile in the style of our logo. You'll get two versions — a full logo with your dog riding the wave, and a standalone portrait."
- Original Gnar Dawgs logo displayed as style reference

**Flow states:**

1. **Upload** — Dropzone/file picker with drag-and-drop. Accepts jpg, png, webp, heic. Preview before submitting.
2. **Provider selection** — "Generate with OpenAI" or "Generate with Gemini" button group.
3. **Generating** — Loading spinner with "Generating your Gnar Dawg..." and original photo displayed.
4. **Review** — Both versions side by side (logo left, standalone dog right). Actions: "Set as Profile Picture", "Generate Again", "Save to Gallery".
5. **Error** — Friendly message with "Try Again" button.

### Profile Page Gallery (`/profile`)

New "Your Gnar Dawgs" section:

- Grid of generated profile images
- Each card shows: logo thumbnail, provider badge, date, "Active" badge if current
- Card actions:
  - "Set as Profile Picture"
  - "View" — expands both versions at full size
  - "Download" — dropdown: "Download Logo" / "Download Dog Portrait" (raw PNG)
  - "Delete" — with confirmation dialog
- Empty state: "You haven't created a Gnar Dawg yet!" with CTA to creator
- "Create Your Gnar Dawg" button always visible at top

## Limits

No limits on generation. Community is trusted.

## A/B Testing

Provider is recorded per generation. Compare results by reviewing images tagged with each provider to decide which to use long-term.

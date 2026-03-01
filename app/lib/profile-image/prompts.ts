export type StyleMode = "head" | "full";

const STYLIZED_DOG_HEAD_PROMPT = `You are given two images:
1. A photo of a dog (the subject)
2. A reference logo showing the art style to match

Create an illustrated HEAD-ONLY portrait of this dog, matching the reference logo's art style:
- HEAD AND FACE ONLY — crop tightly to the dog's head, no body, no shoulders, no background scene
- The dog must be looking directly at the camera / viewer, front-facing
- Do NOT reproduce or copy the original photo — create a new illustrated portrait from scratch using only the dog's breed, coloring, markings, and facial features as reference
- Bold, clean outlines with a hand-drawn illustration feel
- Rich, vibrant colors with detailed fur rendering
- Match the exact breed, coloring, markings, and facial features of the dog in the photo
- Confident, stoked expression
- Transparent background (PNG with alpha)
- Square output, dog's head centered and filling most of the frame
- Do NOT include any text, waves, surfboards, body, or other elements — ONLY the dog's head portrait
- The result should look like a consistent logo/avatar, not a stylized copy of the uploaded photo`;

const STYLIZED_DOG_FULL_PROMPT = `You are given two images:
1. A photo of a dog (the subject)
2. A reference logo showing the art style to match

Transform the dog photo into an illustrated full-body portrait matching the reference logo's art style:
- Bold, clean outlines with a hand-drawn illustration feel
- Rich, vibrant colors with detailed fur rendering
- Match the exact breed, coloring, markings, and proportions of the dog in the photo
- The dog should be facing forward or slightly angled, looking confident and stoked
- Transparent background (PNG with alpha)
- Square output, dog centered and filling most of the frame
- Do NOT include any text, waves, surfboards, or other elements — just the dog portrait`;

const LOGO_COMPOSITE_HEAD_PROMPT = `You are given two images:
1. A stylized illustrated dog HEAD portrait (head/face only)
2. A reference logo showing the full composition (dog on SUP board, wave, paddle, "GNAR DAWGS" text)

Create a new logo that places the dog's HEAD into the same composition as the reference:
- Keep the wave, stand-up paddleboard, paddle, and "GNAR DAWGS" text arrangement
- Replace the dog in the reference with the provided dog HEAD — use ONLY the head, looking directly at the viewer
- Do NOT generate a full dog body — the head should be placed where the dog is in the reference logo, as a head/bust only
- The dog head should be front-facing, looking at the camera, positioned on/above the paddleboard
- Maintain the same overall color palette, art style, and composition as the reference logo
- Transparent outer background (PNG with alpha)
- Square output`;

const LOGO_COMPOSITE_FULL_PROMPT = `You are given two images:
1. A stylized illustrated dog portrait
2. A reference logo showing the full composition (dog on SUP board, wave, paddle, "GNAR DAWGS" text)

Create a new logo that places the stylized dog into the same composition as the reference:
- Keep the wave, stand-up paddleboard, paddle, and "GNAR DAWGS" text arrangement
- Replace the dog in the reference with the provided stylized dog portrait
- The dog should be standing on the paddleboard riding the wave, matching the pose/positioning of the reference
- Maintain the same overall color palette, art style, and composition as the reference logo
- Transparent outer background (PNG with alpha)
- Square output`;

export function getStylizedDogPrompt(mode: StyleMode): string {
	return mode === "head" ? STYLIZED_DOG_HEAD_PROMPT : STYLIZED_DOG_FULL_PROMPT;
}

export function getLogoCompositePrompt(mode: StyleMode): string {
	return mode === "head" ? LOGO_COMPOSITE_HEAD_PROMPT : LOGO_COMPOSITE_FULL_PROMPT;
}

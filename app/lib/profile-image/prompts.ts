export const STYLIZED_DOG_PROMPT = `You are given two images:
1. A photo of a dog (the subject)
2. A reference logo showing the art style to match

Transform the dog photo into an illustrated portrait matching the reference logo's art style:
- Bold, clean outlines with a hand-drawn illustration feel
- Rich, vibrant colors with detailed fur rendering
- Match the exact breed, coloring, markings, and proportions of the dog in the photo
- The dog should be facing forward or slightly angled, looking confident and stoked
- Transparent background (PNG with alpha)
- Square output, dog centered and filling most of the frame
- Do NOT include any text, waves, surfboards, or other elements — just the dog portrait`;

export const LOGO_COMPOSITE_PROMPT = `You are given two images:
1. A stylized illustrated dog portrait
2. A reference logo showing the full composition (dog on SUP board, wave, paddle, "GNAR DAWGS" text)

Create a new logo that places the stylized dog into the same composition as the reference:
- Keep the wave, stand-up paddleboard, paddle, and "GNAR DAWGS" text arrangement
- Replace the dog in the reference with the provided stylized dog portrait
- The dog should be standing on the paddleboard riding the wave, matching the pose/positioning of the reference
- Maintain the same overall color palette, art style, and composition as the reference logo
- Transparent outer background (PNG with alpha)
- Square output`;

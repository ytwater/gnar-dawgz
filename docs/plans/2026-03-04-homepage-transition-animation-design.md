# Homepage Transition Animation

## Problem

When a logged-in user hits the homepage, the view snaps from the large centered logo on slate background to the smaller top logo on dark background with dashboard content. The conditional render swap causes a jarring flash.

## Solution

Replace the two-branch conditional render with a single DOM structure that uses CSS transitions to animate between landing and dashboard states.

## States

| State | Logo | Background | Nav + Dashboard |
|---|---|---|---|
| `landing` | 700px, vertically centered | `bg-slate-500` | Hidden |
| `transitioning` | Shrinks to 300px, moves to top | Fades to `bg-background` | Hidden |
| `dashboard` | 300px, top center | `bg-background` | Fades in |

## Animation Sequence

1. Page loads → show landing state (big logo, slate background)
2. Auth resolves, user is logged in → wait `TRANSITION_DELAY` ms (1500ms for testing, 0 for production)
3. Set state to `transitioning` → CSS transitions kick in (~400ms, `ease-out`):
   - Logo: `max-w-[700px]` → `max-w-[300px]`
   - Logo position: vertically centered → top of page
   - Background color: `bg-slate-500` → `bg-background`
4. On `transitionend` → set state to `dashboard`:
   - Layout nav + dashboard content fade in (`opacity-0` → `opacity-100`, ~200ms)

## Implementation

All changes in `app/routes/_index.tsx`. No animation libraries needed.

### Key changes

1. Add `TRANSITION_DELAY` constant at top of file (1500 for testing, set to 0 later)
2. Add `viewState` state: `"landing" | "transitioning" | "dashboard"`
3. Use `useEffect` to trigger transition after auth + delay
4. Render a single `<main>` with conditional Tailwind classes based on `viewState`
5. Use `onTransitionEnd` on the main container to sequence the dashboard reveal
6. Wrap Layout/nav/dashboard in a div with opacity transition

### Conditional classes on `<main>`

```
landing:       "flex items-center justify-center min-h-screen bg-slate-500"
transitioning: "flex items-start justify-center min-h-screen bg-background pt-6"
dashboard:     same as transitioning (classes stay, content fades in)
```

All with `transition-all duration-400 ease-out` applied.

### Logo classes

```
landing/loading: "max-w-[700px] px-4"
transitioning+: "max-w-[300px]"
```

With `transition-all duration-400 ease-out` on the img.

### Dashboard reveal

```jsx
<div className={`transition-opacity duration-200 ${viewState === "dashboard" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
  <Layout> ... nav + dashboard ... </Layout>
</div>
```

## Test delay

```ts
// Set to 0 for production, higher values for testing the animation
const TRANSITION_DELAY = 1500;
```

## Edge cases

- **Not logged in**: stays in `landing` state permanently, no animation triggers
- **Session loading**: stays in `landing` state while `sessionLoading` is true
- **No dehydrated state**: if auth resolves but loader data isn't ready, stay in landing

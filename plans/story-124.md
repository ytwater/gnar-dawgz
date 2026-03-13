# Implementation Plan

## Overall Approach

This implementation will update the surf dashboard to include:
1. **Simplified forecast graphs** showing wave height, period, tide, and wind in a cleaner format
2. **AI-generated surf reports** cached for 4 hours with automated generation for Torrey Pines at 5am daily
3. **Loading states** with animations during report generation
4. **Error handling** for failed report generation

The AI surf reports will be generated using existing forecast and weather data from the database, creating concise radio-style summaries. We'll add a new database table for caching reports, implement a scheduled job for Torrey Pines, and create on-demand generation for other spots.

## Files to Create or Modify

### 1. Database Schema & Migration

**Create: `drizzle/0015_add_surf_reports.sql`**
```sql
CREATE TABLE surf_reports (
  id TEXT PRIMARY KEY,
  surf_spot_id INTEGER NOT NULL REFERENCES surf_spots(id),
  report TEXT NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (surf_spot_id) REFERENCES surf_spots(id)
);

CREATE INDEX idx_surf_reports_spot_generated ON surf_reports(surf_spot_id, generated_at DESC);
CREATE INDEX idx_surf_reports_expires ON surf_reports(expires_at);
```

**Modify: `app/lib/schema.ts`**
- Add `surfReports` table schema using Drizzle ORM
- Define relationships between `surfReports` and `surfSpots`

### 2. Surf Report Schema & Types

**Create: `app/lib/surf-report-schema.ts`**
- Define Zod schemas for surf report creation, retrieval, and caching
- Export types for surf report data structures
- Add validation for report generation requests

### 3. AI Surf Report Generation

**Create: `app/lib/surf-report/generate-report.ts`**
- Function to generate AI surf report from forecast/weather data
- Analyze wave height, period, tide, and wind conditions
- Create concise, radio-style summary (2-3 paragraphs max)
- Include current conditions and 24-hour outlook
- Use simple language pattern matching or template-based generation (no external AI API needed based on requirements)

**Create: `app/lib/surf-report/cache-manager.ts`**
- Check if valid cached report exists (within 4 hours)
- Retrieve cached report if valid
- Store new report with 4-hour expiration
- Clean up expired reports

### 4. ORPC Router for Surf Reports

**Create: `app/lib/orpc/routers/surf-report-router.ts`**
- `getSurfReport` procedure: fetch or generate report for a spot
  - Check cache first
  - Generate on-demand if cache expired/missing
  - Handle errors gracefully
- `generateSurfReport` procedure: force regeneration (admin use)
- Export router

**Modify: `app/lib/orpc/router.ts`**
- Import and mount `surfReportRouter`

### 5. React Query Hook

**Create: `app/lib/orpc/hooks/use-surf-report.ts`**
- `useSurfReport(spotId)` hook for fetching reports
- Handle loading, error, and success states
- Automatic refetch on stale data

### 6. Dashboard UI Components

**Create: `app/components/surf-report/SurfReport.tsx`**
- Display AI-generated surf report at top of dashboard
- Show loading animation while generating
- Display error state if generation fails
- Markdown rendering for report content
- Timestamp of report generation

**Create: `app/components/surf-report/SurfReportSkeleton.tsx`**
- Animated loading skeleton with wave/surf theme
- Use existing `Spinner` component or create custom animation

**Modify: `app/components/weather/index.ts`**
- Export new surf report components

**Create: `app/components/graphs/SimplifiedForecastGraphs.tsx`**
- Individual graph components for:
  - Wave Height (line chart)
  - Wave Period (line chart)
  - Tide (area chart)
  - Wind Speed & Direction (line chart with direction indicators)
- Use lightweight charting library (recharts or similar)
- Clean, minimal design with time on x-axis
- Responsive layout (grid or stacked)

### 7. Dashboard Page Updates

**Modify: `app/routes/_app.surf-dashboard.tsx`**
- Import `SurfReport` and `SimplifiedForecastGraphs` components
- Add surf report section at top of page
- Replace existing confusing graphs with simplified versions
- Pass selected surf spot ID to components
- Handle spot selection state

### 8. Scheduled Task for Torrey Pines

**Create: `workers/scheduled-surf-report.ts`**
- Cloudflare Worker scheduled task (cron: "0 5 * * *")
- Generate surf report for Torrey Pines at 5am daily
- Log success/failure
- Ignore failures (on-demand will regenerate)

**Modify: `wrangler.json`**
- Add scheduled trigger configuration for surf report generation

### 9. Testing & Utilities

**Create: `scripts/test-surf-report.ts`**
- Script to test surf report generation
- Verify caching behavior
- Test with various forecast conditions

**Create: `app/lib/surf-report/__tests__/generate-report.test.ts`**
- Unit tests for report generation logic
- Test different wave/wind conditions
- Verify report quality and format

## Implementation Steps

1. **Database Setup**
   - Create migration for surf_reports table
   - Update schema definitions
   - Run migration

2. **Core Logic Layer**
   - Implement report generation algorithm
   - Build cache manager
   - Create surf report schema

3. **API Layer**
   - Build ORPC router for surf reports
   - Create React Query hook

4. **UI Components**
   - Build SurfReport component with loading states
   - Create SimplifiedForecastGraphs components
   - Design loading skeleton

5. **Dashboard Integration**
   - Update surf dashboard route
   - Wire up components with data hooks
   - Test error handling

6. **Scheduled Task**
   - Implement Cloudflare Worker scheduled task
   - Configure cron trigger
   - Test Torrey Pines daily generation

7. **Testing & Refinement**
   - Test on-demand generation for all spots
   - Verify caching behavior (4-hour window)
   - Ensure loading animations work smoothly
   - Test error states

## Acceptance Criteria

- [ ] Surf dashboard displays simplified graphs for wave height, period, tide, and wind
- [ ] AI-generated surf report appears at top of dashboard for selected spot
- [ ] Cool loading animation displays while report is being generated
- [ ] Cached reports are served when valid (within 4 hours)
- [ ] Torrey Pines report generates automatically at 5am daily
- [ ] All other spots generate reports on-demand when dashboard is viewed
- [ ] Error message displays if on-demand generation fails
- [ ] Failed automated Torrey Pines generation is silently ignored (retry on-demand)
- [ ] Reports are concise and radio-style (similar to surf report you'd hear on radio)
- [ ] Graphs are cleaner and easier to read than previous version
- [ ] Loading states are smooth and don't block UI
- [ ] Database properly stores and retrieves cached reports
- [ ] Expired reports are handled correctly

## Technical Considerations

- **No External AI API**: Report generation uses template-based approach with forecast data analysis
- **Caching Strategy**: 4-hour TTL stored in database, indexed for performance
- **Scheduled Tasks**: Cloudflare Workers cron for reliable 5am generation
- **Error Resilience**: Graceful degradation if generation fails
- **Performance**: React Query caching + database caching for optimal UX
- **Responsive Design**: Graphs and report display well on mobile and desktop
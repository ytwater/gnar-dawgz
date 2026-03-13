# Implementation Plan

## Overall Approach

This implementation will transform the home page dashboard into a SurfLine-inspired surf report with AI-generated commentary. The plan focuses on simplifying data visualization to answer "when will it be good?" while adding a natural, radio-style surf report at the top. We'll implement a caching system with scheduled generation for Torrey Pines and on-demand generation for other spots.

### Key Components:
1. Redesigned dashboard UI with simplified, intuitive graphs
2. AI-generated surf report service using existing database data
3. Report caching system with 4-hour TTL
4. Scheduled task for Torrey Pines 5am PT generation
5. On-demand generation for other spots

---

## Files to Create

### 1. `app/services/ai_surf_report_generator.py`
**Purpose**: Generate human-readable surf reports from database data

**Implementation Details**:
- Query relevant data from database (wave height, period, wind, tide, swell direction, water temp, recent conditions)
- Format data into prompt for AI model (OpenAI GPT-4 or similar)
- Generate 2-3 paragraph radio-style report covering:
  - Current conditions overview
  - Best times to surf today
  - What to expect (crowd, skill level recommendations)
  - Any notable hazards or special conditions
- Return structured report with timestamp and spot ID

**Key Methods**:
- `generate_report(spot_id: int) -> dict`: Main generation method
- `_fetch_spot_data(spot_id: int) -> dict`: Aggregate database data
- `_build_prompt(data: dict) -> str`: Create AI prompt
- `_call_ai_service(prompt: str) -> str`: Interface with AI API

### 2. `app/models/surf_report.py`
**Purpose**: Database model for cached surf reports

**Schema**:
```python
class SurfReport(db.Model):
    id: int (primary key)
    spot_id: int (foreign key, indexed)
    report_text: str (text field)
    generated_at: datetime (indexed)
    expires_at: datetime (indexed)
    data_snapshot: json (optional - store raw data used)
```

### 3. `app/services/surf_report_cache.py`
**Purpose**: Manage report caching logic

**Implementation Details**:
- Check cache validity (4-hour expiration)
- Retrieve cached reports
- Store new reports with expiration timestamps
- Handle cache invalidation

**Key Methods**:
- `get_or_generate_report(spot_id: int) -> dict`: Primary public interface
- `get_cached_report(spot_id: int) -> dict | None`: Check cache
- `cache_report(spot_id: int, report: dict) -> None`: Store with 4hr TTL
- `is_cache_valid(report: SurfReport) -> bool`: Check expiration

### 4. `app/tasks/scheduled_reports.py`
**Purpose**: Scheduled task runner for Torrey Pines

**Implementation Details**:
- Configure scheduled task using Celery, APScheduler, or cron
- Run daily at 5am Pacific Time
- Call report generation service for Torrey Pines
- Log success/failure (but don't retry on failure per requirements)
- Graceful error handling

**Key Functions**:
- `generate_torrey_pines_report()`: Main scheduled task
- `setup_schedule()`: Initialize scheduler configuration

### 5. `app/api/routes/surf_reports.py`
**Purpose**: API endpoints for surf reports

**Endpoints**:
- `GET /api/surf-reports/<spot_id>`: Get report (cached or generate on-demand)
- `POST /api/surf-reports/<spot_id>/refresh`: Force regeneration (admin only)

### 6. `frontend/src/components/SurfReportCard.tsx` (or `.jsx`)
**Purpose**: Display AI-generated surf report

**Implementation Details**:
- Styled card component at top of dashboard
- Radio-style text display with attractive typography
- Show generation timestamp
- Loading state during generation
- Error state with fallback message

### 7. `frontend/src/components/SimplifiedConditionsGraphs.tsx` (or `.jsx`)
**Purpose**: Redesigned graphs focused on "when will it be good?"

**Implementation Details**:
- **Conditions Timeline Graph**: Single unified view showing ideal surf windows
  - Color-coded timeline (green=good, yellow=moderate, red=poor)
  - Based on combined factors: wave height, wind, tide
  - Hourly breakdown for next 24-48 hours
  - Clear "Best Times" markers

- **Wave Height Trend**: Simplified line graph
  - Clean, minimal design
  - Highlight optimal height ranges
  - Next 24-48 hours

- **Wind & Tide Summary**: Compact card-style display
  - Current conditions
  - Key times (high/low tide, wind direction changes)
  - Icons for quick scanning

### 8. `frontend/src/pages/Dashboard.tsx` (or `.jsx`)
**Purpose**: Updated dashboard layout

**Layout Structure**:
```
┌─────────────────────────────────────────┐
│  AI Surf Report Card                    │
│  (Radio-style commentary)               │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Conditions Timeline (when it's good)   │
└─────────────────────────────────────────┘
┌──────────────────┬──────────────────────┐
│  Wave Height     │  Wind & Tide Summary │
└──────────────────┴──────────────────────┘
┌─────────────────────────────────────────┐
│  Spot Selector / Additional Info        │
└─────────────────────────────────────────┘
```

---

## Files to Modify

### 1. `app/models/__init__.py`
- Import and register new `SurfReport` model

### 2. `app/config.py`
- Add AI service API credentials (OpenAI key, model selection)
- Add cache duration constant (4 hours)
- Add Torrey Pines spot ID constant
- Add timezone configuration (Pacific)

### 3. `backend/requirements.txt` (or `pyproject.toml`)
- Add AI service SDK (e.g., `openai>=1.0.0`)
- Add scheduler library (e.g., `apscheduler>=3.10.0` or `celery>=5.3.0`)
- Add timezone library (e.g., `pytz>=2023.3`)

### 4. `frontend/package.json`
- Add any new charting libraries if current ones don't support redesign
- Consider `recharts` or `chart.js` for simplified graphs

### 5. `app/__init__.py` or main application factory
- Initialize scheduler
- Register scheduled tasks
- Start Torrey Pines 5am task

### 6. Database Migration
- Create migration script for `surf_reports` table
- Add indexes on `spot_id` and `generated_at` fields

### 7. `frontend/src/api/surfReportsApi.ts` (or `.js`)
- Add API client methods for fetching surf reports
- Handle loading and error states

### 8. `frontend/src/styles/` or CSS modules
- Create/update styles for SurfLine-inspired design
- Clean, modern aesthetic for graphs
- Typography for radio-style report text

---

## Implementation Sequence

### Phase 1: Backend Foundation (Days 1-2)
1. Create `SurfReport` model and run migration
2. Implement `AIReportGenerator` service with database querying
3. Implement `SurfReportCache` service
4. Create API routes for surf reports
5. Add configuration variables

### Phase 2: AI Integration & Scheduling (Days 3-4)
6. Integrate AI service (OpenAI or alternative)
7. Test and refine report generation prompts
8. Implement scheduled task system
9. Configure Torrey Pines 5am generation
10. Test caching and expiration logic

### Phase 3: Frontend Redesign (Days 5-7)
11. Create `SurfReportCard` component
12. Design and implement `SimplifiedConditionsGraphs`
13. Implement conditions timeline algorithm (when it's good)
14. Update dashboard layout
15. Style components to match SurfLine aesthetic
16. Integrate API calls

### Phase 4: Testing & Refinement (Days 8-9)
17. End-to-end testing of scheduled generation
18. Test on-demand generation for multiple spots
19. Verify cache behavior (4-hour expiration)
20. Load testing for AI service calls
21. UI/UX refinement based on "when will it be good" clarity
22. Handle edge cases (missing data, API failures)

---

## Acceptance Criteria

### Functional Requirements
- [ ] AI-generated surf report appears at top of dashboard
- [ ] Report text reads naturally like a radio surf report (2-3 paragraphs)
- [ ] Report clearly indicates best times to surf today
- [ ] Torrey Pines report generates automatically at 5am Pacific daily
- [ ] All surf reports cache for exactly 4 hours
- [ ] Other spots generate reports on-demand when dashboard loads
- [ ] Failed scheduled generation doesn't block system; falls back to on-demand
- [ ] Cache prevents unnecessary AI API calls within 4-hour window

### UI Requirements
- [ ] Dashboard layout resembles SurfLine spot report aesthetic
- [ ] Graphs are significantly simpler than current version
- [ ] "Conditions Timeline" clearly shows when conditions are good (color coding)
- [ ] Users can quickly answer "when should I go surf?" at a glance
- [ ] Wave height graph is clean and minimal
- [ ] Wind and tide info displayed in compact, scannable format
- [ ] Mobile responsive design maintained

### Technical Requirements
- [ ] `surf_reports` table created with proper indexes
- [ ] AI service integration secure (API keys in environment)
- [ ] Scheduled task runs reliably at 5am Pacific
- [ ] Timezone handling correct (Pacific Time)
- [ ] API endpoints return appropriate status codes
- [ ] Error handling for AI service failures (graceful degradation)
- [ ] Database queries optimized for report generation
- [ ] Frontend loading states during report generation
- [ ] No breaking changes to existing spot data functionality

### Performance Requirements
- [ ] Dashboard loads in <3 seconds with cached report
- [ ] On-demand generation completes in <10 seconds
- [ ] AI API rate limits respected
- [ ] Database queries for report data execute in <500ms
- [ ] No N+1 query problems when fetching spot data

### Data Quality Requirements
- [ ] AI reports use actual database data (not hallucinated)
- [ ] Reports include relevant metrics: wave height, wind, tide, temperature
- [ ] Timestamp shown on report indicating when generated
- [ ] Reports sound professional and helpful (not robotic)
- [ ] Skill level and crowd recommendations when data available

---

## Risks & Mitigations

### Risk 1: AI Service Costs
**Mitigation**: 4-hour caching significantly reduces API calls; monitor usage and set budget alerts

### Risk 2: AI Report Quality
**Mitigation**: Extensive prompt engineering and testing; include data validation before sending to AI; human review during initial rollout

### Risk 3: Scheduled Task Reliability
**Mitigation**: Implement monitoring/alerting; on-demand fallback means users aren't blocked by failures

### Risk 4: "When Will It Be Good" Algorithm Complexity
**Mitigation**: Start with simple heuristic (wave height + wind direction in optimal ranges); iterate based on user feedback

### Risk 5: Timezone Handling Errors
**Mitigation**: Use established timezone libraries (pytz); extensive testing around DST transitions

---

## Future Enhancements (Out of Scope)

- User feedback on report accuracy ("Was this helpful?")
- Multiple report styles (beginner vs. advanced surfer)
- Push notifications for ideal conditions
- Historical report archive
- Multi-day forecast integration
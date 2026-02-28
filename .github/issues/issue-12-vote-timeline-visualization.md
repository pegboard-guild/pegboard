# Vote timeline visualization component

**Labels:** frontend, canvas, visualization

**Description:**

Build a timeline visualization that shows an official's voting record chronologically, making patterns visible at a glance.

The goal: look at a representative's vote timeline and immediately see whether they vote with their party, how often they're absent, and how their voting pattern has changed over time.

**Design spec:**
- Horizontal timeline (scrollable for long records)
- Each vote is a dot/marker: green (yea), red (nay), gray (absent/abstain)
- Y-axis groups by category (if available): budget, criminal justice, infrastructure, etc.
- Hover tooltip: bill title, date, vote cast, outcome
- Click to navigate to the bill detail
- Filter by: date range, category, party-line vs. cross-party votes

**Implementation:**
1. Create `frontend/src/components/VoteTimeline.svelte`
2. Use D3.js for the timeline axis and positioning
3. SVG rendering with semantic markup
4. Mock vote data from `data/congress_members/` output
5. Smooth horizontal scrolling with touch support

**Acceptance criteria:**
- [ ] Timeline renders with mock vote data
- [ ] Color-coded vote markers (yea/nay/absent)
- [ ] Hover tooltips with bill info
- [ ] Date range filter works
- [ ] Responsive and touch-friendly
- [ ] Accessible

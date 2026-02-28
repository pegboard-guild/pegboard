# Svelte Canvas v1 — representative profile cards

**Labels:** good first issue, frontend, canvas

**Description:**

Build the first Svelte component for Pegboard's Canvas layer: representative profile cards.

This is the entry point to the visual layer. A profile card shows everything Pegboard knows about a single elected official — their votes, donors, committees, and sponsored legislation — pulled from the graph.

**Design spec:**
- Card header: name, photo (if available), title, party, district
- Section: top donors (from FEC/campaign finance data)
- Section: recent votes (last 10, with bill title and vote cast)
- Section: sponsored legislation (last 5 bills)
- Section: committee memberships
- Each section links deeper into the graph

**Implementation:**
1. Create a Svelte app scaffold in `frontend/` (SvelteKit or vanilla Svelte + Vite)
2. Build `ProfileCard.svelte` component
3. Mock data from existing `data/` JSON files for development
4. Responsive layout (mobile-first)
5. Accessible (proper ARIA labels, keyboard navigation)

**Tech decisions:**
- Svelte 5 (runes)
- TailwindCSS for styling
- Data fetched from a future FastAPI backend (mock for now)

**Acceptance criteria:**
- [ ] `frontend/` directory with working Svelte project
- [ ] ProfileCard component renders with mock data
- [ ] Responsive on mobile and desktop
- [ ] Accessible markup
- [ ] README in `frontend/` with setup instructions

# Budget treemap visualization component

**Labels:** frontend, canvas, visualization

**Description:**

Build a treemap visualization component that shows government budget allocations as nested, proportionally-sized rectangles.

Treemaps are the best way to show "where does the money go?" at a glance. A city's $5B budget becomes immediately legible: public safety takes 40%, infrastructure 15%, etc. Users can click into departments to see line-item detail.

**Design spec:**
- Top level: budget categories (Public Safety, Infrastructure, Health, Education, etc.)
- Click to drill down: department → program → line item
- Color coding by category
- Tooltip on hover: category name, dollar amount, percentage of total
- Breadcrumb navigation for drill-down levels

**Implementation:**
1. Create `frontend/src/components/BudgetTreemap.svelte`
2. Use D3.js `d3-hierarchy` and `d3-treemap` for layout calculation
3. Render with SVG or Canvas (SVG preferred for accessibility)
4. Mock budget data structure in `frontend/src/mock/budget.json`
5. Animate transitions when drilling down

**Data format expected:**
```json
{
  "name": "City of Dallas FY2025",
  "amount": 4200000000,
  "children": [
    { "name": "Public Safety", "amount": 1680000000, "children": [...] }
  ]
}
```

**Acceptance criteria:**
- [ ] Treemap renders with mock budget data
- [ ] Click-to-drill-down works at least 2 levels deep
- [ ] Tooltips show name, amount, percentage
- [ ] Responsive sizing
- [ ] Accessible (keyboard navigation, screen reader labels)

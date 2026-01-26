# OpenHouse Sales Pipeline: Implementation Brief

---

## 🎯 THE ONLY THING THAT MATTERS

**Simplicity.**

Not "simple enough." Not "intuitive once you learn it." Not "powerful but approachable."

**Stupid simple.**

A property developer who has used Excel for 20 years should open this, understand it instantly, and think: *"This is better. Obviously."*

If they need to be told it's better, we've failed.
If they need a tutorial, we've failed.
If they need to "give it a chance," we've failed.

**The value must be self-evident in 5 seconds.**

---

## The Test

Before building anything, ask:

> *"Would a 55-year-old developer who hates technology understand this immediately?"*

If no, simplify until yes.

---

## What We're Replacing

An Excel spreadsheet. That's it.

Excel works because:
- Click cell → type → done
- No logins, no loading, no bullshit
- Information is right there, all of it, in a grid

We must be **better than Excel**, not "as good as Excel but online."

Better means:
- **Faster** (one click vs many)
- **Smarter** (tells you what needs attention)
- **Automatic** (sends you updates without asking)

But never at the cost of simplicity.

---

## The Core Product: A Table

Not a dashboard. Not a Kanban board. Not cards. Not widgets.

**A table.**

Rows = Units
Columns = Dates

That's it. Everything else is secondary.

```
┌─────────────┬───────────┬─────────┬─────────┬───────────┬─────────┐
│ Unit        │ Name      │ Release │ Deposit │ Contracts │ Signed  │ →
├─────────────┼───────────┼─────────┼─────────┼───────────┼─────────┤
│ 1 The Rise  │ J Murphy  │ 15 Sep  │ 05 Oct  │ 10 Oct 🔴 │   —     │
│ 2 The Rise  │ S O'Brien │ 15 Sep  │ 08 Oct  │ 15 Oct 🔴 │   —     │
│ 3 The Rise  │ P Kelly   │ 20 Sep  │ 20 Oct  │ 02 Jan 🟠 │   —     │
│ 4 The Rise  │ M Walsh   │ 20 Sep  │ 25 Oct  │ 15 Jan 🟢 │ 20 Jan  │
└─────────────┴───────────┴─────────┴─────────┴───────────┴─────────┘
```

A developer looks at this and instantly knows:
- Units 1 & 2 have a problem (red dots)
- Unit 3 needs watching (amber)
- Unit 4 is fine (green) and has progressed

**No explanation needed. The colour tells the story.**

---

## The 14 Columns

| # | Column | What It Is |
|---|--------|------------|
| 1 | Unit | The address |
| 2 | Name | Buyer's name |
| 3 | Release | When it went on market |
| 4 | Sale Agreed | Handshake deal done |
| 5 | Deposit | Money received |
| 6 | Contracts Issued | Sent to buyer's solicitor |
| 7 | Queries | Click to see notes |
| 8 | Signed Contracts | Buyer signed |
| 9 | Counter Signed | Developer signed |
| 10 | Kitchen | Selection complete |
| 11 | Snag | Inspection done |
| 12 | De-snag | Fixes signed off |
| 13 | Drawdown | Bank released funds |
| 14 | Handover | Keys handed over |

**Why these 14?** Because this is the actual journey of a house sale. Nothing more, nothing less.

**Why dates not statuses?** Because "when did it happen" is more useful than "has it happened." Dates tell the full story.

---

## The Traffic Lights (The Magic)

This is what Excel can't do automatically.

Every date cell knows if it's overdue. The system does the thinking so the developer doesn't have to.

### Contracts Issued → Signed
| Status | Time Since Issue |
|--------|------------------|
| 🟢 Green | 0-28 days |
| 🟠 Amber | 29-42 days |
| 🔴 Red | 43+ days |

### Kitchen Selection (after contracts signed)
| Status | Time Since Signing |
|--------|-------------------|
| 🟢 Green | 0-14 days |
| 🟠 Amber | 15-28 days |
| 🔴 Red | 29+ days |

### Snagging (before handover)
| Status | Days Until Handover |
|--------|---------------------|
| 🟢 Green | 30+ days |
| 🟠 Amber | 14-30 days |
| 🔴 Red | <14 days (not scheduled) |

### De-snag (before drawdown)
| Status | Days Until Drawdown |
|--------|---------------------|
| 🟢 Green | 7+ days |
| 🟠 Amber | 3-7 days |
| 🔴 Red | <3 days (not complete) |

**The developer doesn't configure this.** It just works. Sensible defaults that match how the industry actually operates.

*(Advanced users can adjust thresholds in settings. But they shouldn't need to.)*

---

## How Editing Works

**Click empty cell → Today's date appears. Done.**

That's the entire interaction model.

No modal. No date picker popup. No "Save" button. No confirmation.

Click. Date appears. Move on.

If they need to change it:
- Click the date
- Small calendar appears inline (not a modal)
- Pick new date
- Click away to save

**Keyboard works too:**
- Tab → next cell
- Enter → save and move down
- Escape → cancel
- Type "15/1" → auto-formats to "15 Jan"

**The benchmark is Google Sheets.** Open Sheets, edit a cell. That's how fast this needs to be.

---

## The Three Automations

These are what make OpenHouse invaluable. But they must stay invisible until needed.

### 1. Monday Morning Email

Every Monday at 7am, the developer gets an email:

```
Subject: Weekly Pipeline - Longview Park

🔴 CONTRACTS OVERDUE (6+ weeks)
   • Unit 12 - 49 days (J. Murphy)
   • Unit 8 - 52 days (S. O'Brien)

🟠 CONTRACTS WARNING (4-6 weeks)
   • Unit 23 - 34 days
   • Unit 31 - 29 days

🔴 KITCHEN OVERDUE
   • Unit 19 - signed 35 days ago

📅 SNAGGING THIS WEEK
   • Unit 2 - Tuesday
   • Unit 6 - Thursday

💰 CLOSINGS THIS WEEK
   • Unit 2 - Wednesday
   • Unit 6 - Friday

[View Pipeline →]
```

**No login required to know what needs attention.** The email tells you. Click through only if you need to act.

### 2. One-Click Agent Chase

Button on the pipeline: **"Email Agent"**

Click it. An email opens, pre-written:

```
Subject: Action Required: 4 Contracts Overdue - Longview Park

Hi [Agent],

These contracts need chasing:

• Unit 12 - 49 days since issued (J. Murphy)
• Unit 8 - 52 days since issued (S. O'Brien)
• Unit 23 - 34 days since issued
• Unit 31 - 29 days since issued

Please provide updates.

[Developer Name]
```

**One click. Email ready. Send.**

No composing. No looking up which units are overdue. No maths. The system did it.

### 3. Analytics That Answer Questions

A separate page (not cluttering the main table) that shows:

**"How long does it take to close a sale?"**
→ Average: 60 days (Sale Agreed to Handover)

**"Where do deals get stuck?"**
→ Contracts Issued → Signed (31 days average) ← BOTTLENECK

**"Which solicitors are slow?"**
→ Smith & Co: 45 days average. Murphy & Co: 24 days average.

**"How many closings can I expect next month?"**
→ Based on current pipeline: 6 units

**Simple answers to real questions.** Not charts for the sake of charts.

---

## What NOT To Build

This list is as important as what to build.

### ❌ NO Modals
Every modal is a speed bump. Inline editing only.

### ❌ NO Confirmations
"Are you sure?" = "We don't trust you." Trust the user. Let them undo if needed.

### ❌ NO Toast Notifications
"Saved!" - Yes, obviously. Don't tell me things worked. Tell me if they didn't.

### ❌ NO Onboarding
If it needs explaining, it's too complex. Simplify the UI instead.

### ❌ NO Empty State Illustrations
A cute drawing of a house with "No units yet!" is patronising. Just show the empty table.

### ❌ NO Dashboard Widgets
Stats cards, progress rings, pipeline funnels - all clutter. The table IS the dashboard.

### ❌ NO View/Edit Toggle
Always editable. Why would you ever want to just look?

### ❌ NO Kanban Board
Cards in columns look pretty in demos. Tables are how real work gets done.

### ❌ NO Dropdown Menus for Simple Actions
If there's one obvious action, make it one click. Not click → menu → select.

### ❌ NO Loading Spinners That Block Work
Update optimistically. If it fails, show error. Don't make them wait.

---

## The Simplicity Checklist

Before any feature ships, it must pass ALL of these:

- [ ] **Can a developer understand it without explanation?**
- [ ] **Does it take fewer clicks than Excel?**
- [ ] **Is the information visible at a glance?**
- [ ] **Does it work on mobile with one hand?**
- [ ] **Could you explain it in one sentence?**
- [ ] **Does it solve a real problem they have today?**
- [ ] **Would removing it make the product worse?**

If any answer is "no" or "maybe," don't build it yet.

---

## Information Hierarchy

What the developer sees, in order of prominence:

### 1. The Table (90% of screen)
The data. The units. The dates. The colours.

### 2. Development Name (top left)
Where am I? "Longview Park"

### 3. Action Buttons (top right)
"Email Agent" / "Analytics" / "Settings"
Small. Unobtrusive. There when needed.

### 4. Nothing Else
No sidebar stats. No summary cards. No filters bar. No search box.

The table tells the story. Everything else is noise.

---

## Visual Design Principles

### Dense, Not Sparse
- 36px row height (compact but readable)
- Minimal padding
- Information-rich, not whitespace-rich

### Subtle, Not Loud
- Colours are muted (soft green, not neon)
- Borders are light grey, not black
- Traffic lights are small dots, not flashing badges

### Consistent, Not Clever
- Every date looks the same: "15 Jan"
- Every cell behaves the same way
- No special cases, no exceptions

### Fast, Not Animated
- No slide-in panels with 300ms easing
- No skeleton loaders
- Just show the data, instantly

---

## Technical Requirements (For Cowork)

### Schema

```typescript
// One row per unit
unitSalesPipeline: {
  unit_id,
  purchaser_name,
  purchaser_email,
  release_date,
  sale_agreed_date,
  deposit_date,
  contracts_issued_date,
  signed_contracts_date,
  counter_signed_date,
  kitchen_date,
  snag_date,
  desnag_date,
  drawdown_date,
  handover_date,
  mortgage_expiry_date,  // For alerts
  solicitor_firm,        // For analytics
}

// Notes per unit
unitPipelineNotes: {
  unit_id,
  content,
  is_resolved,
  created_at,
}

// Threshold overrides (optional)
pipelineSettings: {
  development_id,
  contracts_amber_days,  // default 28
  contracts_red_days,    // default 42
  // etc
}

// Digest preferences
digestPreferences: {
  admin_id,
  enabled,
  delivery_day,
  delivery_hour,
}
```

### API

```
GET  /api/pipeline                    → List developments with alert counts
GET  /api/pipeline/[devId]            → Units table with computed statuses
PATCH /api/pipeline/[devId]/[unitId]  → Update one field
POST /api/pipeline/[devId]/chase      → Generate chase email
GET  /api/pipeline/analytics          → Cycle times, velocity, forecasts
```

### Pages

```
/developer/pipeline                   → Development list
/developer/pipeline/[devId]           → The table
/developer/pipeline/analytics         → Analytics page
```

---

## Implementation Order

### Week 1-2: The Table
- Schema + migrations
- API endpoints
- Table UI with all 14 columns
- Click-to-edit dates
- Traffic light calculations
- Notes panel

**Ship when:** A developer can view and edit their pipeline faster than Excel.

### Week 3: The Emails
- Monday digest template + cron job
- Agent chase email generation
- Digest preferences

**Ship when:** Developer gets useful Monday email without configuring anything.

### Week 4-5: The Analytics
- Cycle time calculations
- Bottleneck identification
- Velocity metrics
- Solicitor performance

**Ship when:** Developer can answer "where do deals get stuck?" in one click.

---

## Success Criteria

### The 5-Second Test
Show a developer the pipeline page for 5 seconds. Hide it. Ask:
- "Which units have problems?"
- "What stage are most units at?"

If they can answer, we've succeeded.

### The Pub Test
Developer at the bar, phone in one hand, pint in the other.
Agent calls: "What's the status on Unit 12?"

Can they answer in under 10 seconds? That's the bar.

### The Monday Test
Developer opens email Monday morning.
Without logging in, do they know:
- What needs attention this week?
- What's closing soon?
- What's overdue?

If yes, the digest works.

### The Switch Test
After 2 weeks using OpenHouse, ask:
"Do you want to go back to Excel?"

If the answer is "absolutely not," we've won.

---

## Final Reminder

Every feature, every screen, every interaction must answer:

> **"Is this simpler than it could be?"**

If there's any doubt, simplify.

The developers who will use this are busy, impatient, and sceptical of new software. We don't get a second chance to prove value.

**The product must be so obviously useful that using it feels like common sense.**

That's the standard. Nothing less.

# 🏆 Gold Standard Page Patterns (SSoT)

**This is THE ONE reference for page layout patterns.**

Last updated: Feb 2026

## ⚠️ CRITICAL: Every Page MUST Use a Wrapper

**DO NOT create pages with raw divs and space-y.** Always use one of the standard wrappers below.

**Why:** The parent layout architecture requires proper wrappers to ensure scrolling works correctly across all 260+ pages.

---

## 🎯 The Architecture (How It Works)

```tsx
app/(app)/layout.tsx
  ↓
<main className="h-screen overflow-hidden">
  <div className="h-full overflow-auto">  ← Scroll container (block OR flex)
    {children}  ← Your page goes here
  </div>
</main>
```

**Layout Modes (via LayoutModeContext):**

| Mode | Parent Layout | Use Case | Pages |
|------|---------------|----------|-------|
| `padded` (default) | **Block layout** + overflow-auto | Forms, settings, content | ~193 pages |
| `full-height` | **Flex layout** + overflow-auto | Tables, split views | ~37 pages |
| `edge-to-edge` | Flex layout + overflow-auto | Canvas, maps | ~5 pages |
| `fullscreen` | Flex layout + overflow-auto | Schedule Master | ~1 page |

**Key Insight:**
- Most pages (193) use **block layout** (supports space-y, mt-*, etc.)
- Special pages (37) use **flex layout** (for full-height content)
- Wrappers handle this automatically!

---

## 📋 Gold Standard Patterns

### 1. TablePage - For Full-Height Tables

**Use when:** Page shows TeeemTableView as main content

```tsx
import { TablePage } from "@/components/ui/page-wrappers";
import TeeemTableView from "@/components/table/TeeemTableView";

export default function JobsPage() {
  return (
    <TablePage>
      <TeeemTableView
        foundationId="jobs"
        autoFetchRecords={true}
      />
    </TablePage>
  );
}
```

**What it does:**
- Calls `useSetLayoutMode("full-height")` → Parent becomes flex layout
- Applies `-mx-4` for edge-to-edge table
- Full viewport height with internal scrolling

**Examples:** Jobs, Contacts, Purchase Orders, Estimates, Pricebook

---

### 2. ScrollablePage - For Simple Content

**Use when:** Page has forms, content, or settings that scroll naturally

```tsx
import { ScrollablePage } from "@/components/ui/page-wrappers";

export default function ProfilePage() {
  return (
    <ScrollablePage>
      <h1>Profile Settings</h1>
      <form className="space-y-6">
        {/* form fields */}
      </form>
    </ScrollablePage>
  );
}
```

**What it does:**
- Uses default "padded" mode → Parent is block layout
- Applies `flex flex-col gap-6` (works in block parent!)
- Page scrolls naturally when content overflows

**Examples:** Settings pages, simple forms, static content

---

### 3. TabbedPage - For Single Tab Row

**Use when:** Page has one row of tabs with scrollable or full-height content

```tsx
import { TabbedPage } from "@/components/ui/page-wrappers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CorporatePage() {
  return (
    <TabbedPage
      title="Corporate"
      description="Manage corporate entities"
      fullHeight={false}  // Set true for tabs with tables
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="companies">
          {/* scrollable content */}
        </TabsContent>
      </Tabs>
    </TabbedPage>
  );
}
```

**Props:**
- `fullHeight={false}` (default): Scrollable content, block layout
- `fullHeight={true}`: For tabs with tables, flex layout

**Examples:** Corporate, Financial, Xero Integration

---

### 4. TabbedDetailPage - For Entity Details

**Use when:** Showing entity details with multiple tabs (Jobs/[id], Contacts/[id])

```tsx
import { TabbedDetailPage } from "@/components/ui/page-wrappers";

export default function JobDetailPage() {
  return (
    <TabbedDetailPage>
      <StickyHeader />  {/* Job title, status, etc. */}
      <Tabs>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          {/* tab content */}
        </TabsContent>
      </Tabs>
    </TabbedDetailPage>
  );
}
```

**What it does:**
- Calls `useSetLayoutMode("full-height")` → Flex layout
- Sticky header at top
- Tabs scroll independently

**Examples:** Job details, Contact details, Corporate entity details

---

### 5. TabbedSettingsPage - For Multi-Section Settings

**Use when:** Page has multiple tab sections (Personal, Organization)

```tsx
import { TabbedSettingsPage } from "@/components/ui/page-wrappers";

export default function SettingsLayout({ children }) {
  return (
    <TabbedSettingsPage
      title="Settings"
      description="Manage your settings"
    >
      <TabbedSettingsPage.TabSection label="Personal">
        <Tabs>
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </Tabs>
      </TabbedSettingsPage.TabSection>

      <TabbedSettingsPage.TabSection label="Organization">
        <Tabs>
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>
        </Tabs>
      </TabbedSettingsPage.TabSection>

      <TabbedSettingsPage.Content>
        {children}
      </TabbedSettingsPage.Content>
    </TabbedSettingsPage>
  );
}
```

**What it does:**
- Auto-detects if child page uses full-height mode
- Adapts layout accordingly
- Multiple labeled tab sections

**Examples:** /settings layout

---

### 6. FullscreenPage - For Immersive Experiences

**Use when:** Page needs maximum screen real estate (hides sidebar)

```tsx
import { FullscreenPage } from "@/components/ui/page-wrappers";

export default function ScheduleMasterPage() {
  return (
    <FullscreenPage>
      <GanttChart />
    </FullscreenPage>
  );
}
```

**What it does:**
- Calls `useSetLayoutMode("fullscreen")` → Hides sidebar
- Full viewport width and height
- Edge-to-edge content

**Examples:** Schedule Master

---

## 🚫 Anti-Patterns (DON'T DO THIS)

### ❌ Raw divs with space-y

```tsx
// ❌ WRONG - No wrapper, may break scrolling
export default function MyPage() {
  return (
    <div className="space-y-6">
      <h1>Title</h1>
      <form>...</form>
    </div>
  );
}
```

**Why it's wrong:** Parent layout may use flex mode, which breaks space-y.

**Fix:** Use `ScrollablePage`

---

### ❌ Calling useSetLayoutMode from tabs

```tsx
// ❌ WRONG - Tab calling useSetLayoutMode
function MyTab() {
  useSetLayoutMode("full-height");  // DON'T DO THIS
  return <div>Tab content</div>;
}
```

**Why it's wrong:** Causes header to shift when switching tabs.

**Fix:** Call `useSetLayoutMode` from the **page component**, not tabs.

---

### ❌ Multiple tables without TablePage

```tsx
// ❌ WRONG - Table not in TablePage wrapper
export default function JobsPage() {
  return (
    <TeeemTableView foundationId="jobs" />
  );
}
```

**Why it's wrong:** Table needs full-height flex layout to work correctly.

**Fix:** Wrap in `TablePage`

---

## 🔧 Migration Checklist

**If you have an existing page not using wrappers:**

1. ✅ Does page show a TeeemTableView? → Use `TablePage`
2. ✅ Does page have multiple tab sections? → Use `TabbedSettingsPage`
3. ✅ Does page have entity details with tabs? → Use `TabbedDetailPage`
4. ✅ Does page have one tab row? → Use `TabbedPage`
5. ✅ Does page need fullscreen? → Use `FullscreenPage`
6. ✅ Otherwise (forms, content)? → Use `ScrollablePage`

---

## 📊 Current Status

| Category | Count | Status |
|----------|-------|--------|
| Using wrappers | 37 | ✅ Compliant |
| Portal pages | 30 | ✅ Different layout |
| Need migration | ~193 | ⚠️ Use ScrollablePage |

**Goal:** All 260 pages use gold standard wrappers.

---

## 🎓 Learning Resources

- **Component Registry:** `frontend-next/lib/component-registry.ts`
- **Page Wrappers Source:** `frontend-next/components/ui/page-wrappers.tsx`
- **Layout Mode Context:** `frontend-next/contexts/LayoutModeContext.tsx`

---

**Questions?** Check CLAUDE.md or ask in the team channel.

# Vercel-style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Dealio's light "premium SaaS" visual style with a monochrome, Vercel-style dark theme (single theme, no toggle), applied across the whole app — board, sidebar, login, "in development" stub, archive, settings.

**Architecture:** Almost every component in this codebase reads colors/spacing/fonts from CSS custom properties defined in `app/assets/css/variables.css`, with a `[data-theme="dark"] { ... }` override block in `app/assets/css/dark-theme.css` toggled via a `useTheme` composable. Because of this, most of the visual change is achieved by rewriting the token values in `variables.css` to the new dark palette and deleting the light/dark toggle machinery — these tokens cascade automatically into Sidebar, Menu, Login, Buttons, Inputs, Archive, and Settings. Only the kanban board components (`KanbanCard.vue`, `KanbanColumn.vue`, `KanbanStats.vue`) and `UnderDevelopment.vue` need structural (not just token) changes, because their approved design changes layout, not just color.

**Tech Stack:** Nuxt 4, Vue 3, Pinia, `@nuxtjs/google-fonts`, `@nuxt/icon`, Sass (`<style scoped lang="sass">`, indentation-based, no braces/semicolons).

## Global Constraints

- Background everywhere is pure/near-black (`#000`/`#0a0a0a`/`#0a0a0c`), no gradient fills anywhere.
- Font: Inter replaces Manrope app-wide; numeric values (prices, counts) use a monospace font.
- No light/dark theme toggle — the app has exactly one (dark) theme baked into `:root`.
- Money amounts are rendered as plain numbers — **no `₽` symbol** anywhere in the UI.
- Color of a kanban item's type is conveyed only via a small dot indicator (or, for Wishlist rows, the price text) — never via a colored/gradient card background.
- No business logic changes: Pinia stores, Appwrite calls, guest mode, routing stay untouched.
- No test framework exists in this repo (no Vitest) — verification for every task is a Playwright screenshot of the running dev server, checked against the criteria listed in the step.

---

## File Structure

- `app/assets/css/variables.css` — rewritten token values (palette, fonts, shadows). Structure (variable names) unchanged so every consumer keeps working.
- `app/assets/css/dark-theme.css` — deleted (no second theme).
- `app/composables/useTheme.ts` — deleted.
- `app/components/ui/ThemeToggle.vue` — deleted.
- `nuxt.config.ts` — drop `dark-theme.css` from `css`, swap Google Fonts family.
- `app/components/layout/Sidebar.vue`, `app/components/layout/MobileBottomNav.vue`, `app/layouts/default.vue` — remove `ThemeToggle`/`useTheme` usage.
- `app/components/ui/button/Button.vue` — drop hardcoded teal shadow color on the primary variant.
- `app/pages/login.vue`, `app/components/kanban/KanbanBoard.vue` — fold the now-dead `[data-theme="dark"]` override into the base rule.
- `app/components/kanban/KanbanStats.vue` — rewritten: pill-chips instead of stat-tile grid.
- `app/components/kanban/KanbanCard.vue`, `app/components/kanban/KanbanColumn.vue` — rewritten: dense row list instead of block cards; price formatting drops `₽`.
- `app/components/ui/UnderDevelopment.vue` — rewritten: simple centered icon/title/description, no blurred backdrop mock or frosted glass card.

---

### Task 1: Global design tokens (palette, fonts)

**Files:**
- Modify: `app/assets/css/variables.css`
- Modify: `nuxt.config.ts`
- Delete: `app/assets/css/dark-theme.css`

**Interfaces:**
- Consumes: nothing (this is the root of the cascade).
- Produces: every CSS variable consumed by later tasks and by already-token-driven components (Sidebar, Menu, Button, Login, Archive, Settings) — the names below must stay exact since dozens of components reference them: `--color-bg`, `--color-bg-secondary`, `--color-bg-surface`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--color-border-hover`, `--color-card-bg`, `--color-card-border`, `--color-primary`, `--color-button-primary-bg`, `--color-button-primary-text`, `--font-family-base`, `--font-numeric`, `--kanban-ideas-color`, `--kanban-tasks-color`, `--kanban-doing-color`, `--kanban-done-tracker-color`, `--kanban-wishlist-color`.

- [ ] **Step 1: Replace the font and remove the second theme module reference**

Edit `nuxt.config.ts` — replace the google-fonts block and the `css` array:

```ts
        [
            '@nuxtjs/google-fonts',
            {
                families: {
                    Inter: [400, 500, 600, 700],
                    'Roboto Mono': [500, 600]
                },
                display: 'swap',
                preload: true,
                subsets: ['latin', 'cyrillic']
            }
        ]
    ],

    css: [
        '@/assets/css/normalize.css',
        '@/assets/css/variables.css',
        '@/assets/css/kanban-effects.css',
    ],
```

(This removes the `Manrope` family, adds `Roboto Mono` for numeric values, and drops `@/assets/css/dark-theme.css` from the `css` array — keep everything else in the file unchanged.)

- [ ] **Step 2: Delete the dark theme override file**

```bash
rm app/assets/css/dark-theme.css
```

- [ ] **Step 3: Rewrite `variables.css` with the new dark palette**

Replace the entire content of `app/assets/css/variables.css` with:

```css
/* assets/css/variables.css */
:root {
    /* Основные цвета */
    --color-white: #ffffff;
    --color-black: #000000;

    /* Системные цвета — монохром + единичный белый акцент (Vercel-style) */
    --color-primary: #ffffff;
    --color-primary-hover: #e5e5e5;
    --color-primary-active: #d4d4d4;
    --color-primary-light: rgba(255, 255, 255, 0.06);
    --color-primary-muted: rgba(255, 255, 255, 0.12);
    --color-secondary: #888888;
    --color-secondary-hover: #aaaaaa;
    --color-accent: #ff9a44;
    --color-accent-hover: #ffac63;
    --color-success: #34e89e;
    --color-success-hover: #4eedab;
    --color-danger: #f87171;
    --color-danger-hover: #fb9a9a;
    --color-danger-light: rgba(248, 113, 113, 0.08);
    --color-warning: #ff9a44;
    --color-warning-hover: #ffac63;
    --color-info: #4facfe;
    --color-info-hover: #6fbdfe;

    /* Цвета фона */
    --color-bg: #000000;
    --color-bg-secondary: #0a0a0a;
    --color-bg-tertiary: #111111;
    --color-bg-surface: #000000;
    --color-bg-overlay: rgba(0, 0, 0, 0.6);
    --color-bg-alt: #0a0a0a;

    /* Цвета текста */
    --color-text: #f5f5f7;
    --color-text-secondary: #b0b0b3;
    --color-text-tertiary: #888888;
    --color-text-muted: #666666;
    --color-text-inverse: #000000;

    /* Цвета для компонентов */
    --color-border: #1f1f1f;
    --color-border-hover: #2a2a2a;
    --color-border-focus: #ffffff;

    /* Цвета для карточек */
    --color-card-bg: #0a0a0a;
    --color-card-border: #1f1f1f;
    --color-card-shadow: rgba(0, 0, 0, 0.4);

    /* Цвета для кнопок */
    --color-button-primary-bg: #ffffff;
    --color-button-primary-bg-hover: #e5e5e5;
    --color-button-primary-text: #000000;
    --color-button-secondary-bg: #111111;
    --color-button-secondary-bg-hover: #1a1a1a;
    --color-button-secondary-text: #f5f5f7;
    --color-button-outline-border: #2a2a2a;
    --color-button-outline-text: #f5f5f7;
    --color-button-outline-text-hover: #ffffff;
    --color-button-ghost-text: #888888;
    --color-button-ghost-text-hover: #f5f5f7;
    --color-button-danger-bg: #f87171;
    --color-button-danger-bg-hover: #fb9a9a;
    --color-button-danger-text: #000000;
    --color-button-disabled-bg: #111111;
    --color-button-disabled-text: #4d4d4d;

    /* Цвета для инпутов */
    --color-input-bg: #0a0a0a;
    --color-input-border: #2a2a2a;
    --color-input-border-hover: #3a3a3a;
    --color-input-border-focus: #ffffff;
    --color-input-text: #f5f5f7;
    --color-input-placeholder: #666666;
    --color-input-disabled-bg: #111111;
    --color-input-disabled-text: #4d4d4d;

    /* Тени — почти не используются (плоский дизайн), оставлены минимальными для модалок/дропдаунов */
    --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.5);
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5);
    --shadow-md: 0 4px 10px rgba(0, 0, 0, 0.5);
    --shadow-lg: 0 10px 24px rgba(0, 0, 0, 0.55);
    --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.6);
    --shadow-card-hover: 0 0 0 1px var(--color-border-hover);

    /* Радиусы */
    --radius-xs: 3px;
    --radius-sm: 5px;
    --radius-md: 8px;
    --radius-lg: 10px;
    --radius-xl: 14px;
    --radius-2xl: 18px;
    --radius-full: 9999px;

    /* Отступы */
    --spacing-0: 0;
    --spacing-1: 0.25rem; /* 4px */
    --spacing-2: 0.5rem; /* 8px */
    --spacing-3: 0.75rem; /* 12px */
    --spacing-4: 1rem; /* 16px */
    --spacing-5: 1.25rem; /* 20px */
    --spacing-6: 1.5rem; /* 24px */
    --spacing-7: 1.75rem; /* 28px */
    --spacing-8: 2rem; /* 32px */
    --spacing-9: 2.25rem; /* 36px */
    --spacing-10: 2.5rem; /* 40px */
    --spacing-11: 2.75rem; /* 44px */
    --spacing-12: 3rem; /* 48px */

    /* Шрифты */
    --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-size-xs: 0.6875rem; /* 11px */
    --font-size-sm: 0.8125rem; /* 13px */
    --font-size-base: 0.9375rem; /* 15px */
    --font-size-lg: 1.0625rem; /* 17px */
    --font-size-xl: 1.1875rem; /* 19px */
    --font-size-2xl: 1.375rem; /* 22px */
    --font-size-3xl: 1.75rem; /* 28px */
    --font-size-4xl: 2.125rem; /* 34px */
    --font-size-5xl: 2.75rem; /* 44px */

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    --font-weight-extrabold: 800;

    /* Высота линии */
    --line-height-none: 1;
    --line-height-tight: 1.25;
    --line-height-snug: 1.375;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.625;
    --line-height-loose: 2;

    /* Числа: моноширинный шрифт, табличная цифровая верстка */
    --font-numeric: 'Roboto Mono', monospace;
    --font-feature-numeric: "tnum", "tabular-nums";

    /* Breakpoints */
    --breakpoint-xs: 0;
    --breakpoint-sm: 576px;
    --breakpoint-md: 768px;
    --breakpoint-lg: 992px;
    --breakpoint-xl: 1200px;
    --breakpoint-xxl: 1400px;

    /* Z-index */
    --z-index-dropdown: 1000;
    --z-index-sticky: 1020;
    --z-index-fixed: 1030;
    --z-index-modal-backdrop: 1040;
    --z-index-modal: 1050;
    --z-index-popover: 1060;
    --z-index-tooltip: 1070;

    /* Transition */
    --transition-fast: 0.1s;
    --transition-normal: 0.18s;
    --transition-slow: 0.28s;
    --transition-ease: cubic-bezier(0.4, 0, 0.2, 1);

    /* Компоненты */
    --navbar-height: 60px;
    --border-width: 1px;
    --sidebar-width-expanded: 220px;
    --sidebar-width-collapsed: 64px;

    /* Kanban column colors (ideas / tasks / doing / done / wishlist) — точки-индикаторы, не фон */
    --kanban-todo-color: #888888;
    --kanban-todo-bg: rgba(136, 136, 136, 0.08);
    --kanban-agreed-color: #4facfe;
    --kanban-agreed-bg: rgba(79, 172, 254, 0.08);
    --kanban-progress-color: #ff9a44;
    --kanban-progress-bg: rgba(255, 154, 68, 0.08);
    --kanban-produced-color: #a78bfa;
    --kanban-produced-bg: rgba(167, 139, 250, 0.08);
    --kanban-done-color: #34e89e;
    --kanban-done-bg: rgba(52, 232, 158, 0.08);
    /* tracker statuses */
    --kanban-ideas-color: #4facfe;
    --kanban-ideas-bg: rgba(79, 172, 254, 0.08);
    --kanban-tasks-color: #a78bfa;
    --kanban-tasks-bg: rgba(167, 139, 250, 0.08);
    --kanban-doing-color: #ff9a44;
    --kanban-doing-bg: rgba(255, 154, 68, 0.08);
    --kanban-done-tracker-color: #34e89e;
    --kanban-done-tracker-bg: rgba(52, 232, 158, 0.08);
    --kanban-wishlist-color: #ff6b9d;
    --kanban-wishlist-bg: rgba(255, 107, 157, 0.08);

    /* Error colors */
    --color-error-bg: rgba(248, 113, 113, 0.08);
    --color-error-text: #f87171;
    --color-error-border: rgba(248, 113, 113, 0.25);

    /* Kanban board surface — без точечной сетки, плоский чёрный фон */
    --kanban-grid-pattern: none;
    --kanban-grid-size: 0 0;
    --kanban-surface-bg: #000000;
    --kanban-column-bg: transparent;
    --kanban-column-border: transparent;
    --kanban-column-shadow: none;
    --kanban-card-bg: #0a0a0a;
}
```

- [ ] **Step 4: Verify visually**

Run: `cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio && npm run dev`

Use Playwright: `mcp__playwright__browser_navigate` to `http://localhost:3000/login`, then `mcp__playwright__browser_take_screenshot` (fullPage: true).

Expected: background is black, the login card area is dark (not yet redesigned in markup, but no longer using teal/light tokens), no console errors about missing CSS file.

- [ ] **Step 5: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add app/assets/css/variables.css nuxt.config.ts
git rm app/assets/css/dark-theme.css
git commit -m "feat(design): replace light/teal token palette with Vercel-style dark tokens"
```

---

### Task 2: Remove the theme toggle entirely

**Files:**
- Delete: `app/composables/useTheme.ts`
- Delete: `app/components/ui/ThemeToggle.vue`
- Modify: `app/layouts/default.vue`
- Modify: `app/components/layout/Sidebar.vue`
- Modify: `app/components/layout/MobileBottomNav.vue`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks (this only removes dead code paths).

- [ ] **Step 1: Delete the composable and component**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
rm app/composables/useTheme.ts app/components/ui/ThemeToggle.vue
```

- [ ] **Step 2: Remove `useTheme` from the layout**

In `app/layouts/default.vue`, remove the import and the call. Change:

```ts
import { useTheme } from '~/composables/useTheme'
```

```ts
const { initTheme } = useTheme()
```

```ts
onMounted(async () => {
  initTheme()

  if (route.path === '/login') {
```

to:

```ts
onMounted(async () => {
  if (route.path === '/login') {
```

(Delete the `import { useTheme } from '~/composables/useTheme'` line and the `const { initTheme } = useTheme()` line entirely; remove only the `initTheme()` call inside `onMounted`, keep the rest of the function body as-is.)

- [ ] **Step 3: Remove the toggle from Sidebar**

In `app/components/layout/Sidebar.vue`, delete this block from the template:

```html
      <div class="sidebar__theme-toggle">
        <UiThemeToggle />
        <span v-if="isOpen" class="footer-label">Тема</span>
      </div>
```

Also delete the now-unused `.sidebar__theme-toggle` rule from `<style>`:

```sass
  &__theme-toggle
    display: flex
    align-items: center
    gap: var(--spacing-3)
    padding: var(--spacing-1) 0
```

And remove `.sidebar__theme-toggle` from the collapsed-state selector list:

```sass
    .sidebar__theme-toggle
      justify-content: center
```

- [ ] **Step 4: Remove the toggle from the mobile bottom nav**

In `app/components/layout/MobileBottomNav.vue`, delete this block from the template:

```html
          <div class="additional-item theme-toggle-item">
            <UiThemeToggle />
            <span class="additional-item__label">Сменить тему</span>
          </div>
```

And delete the now-unused `.theme-toggle-item` rule from `<style>`:

```sass
.theme-toggle-item
  gap: var(--spacing-3)
  padding: var(--spacing-2) var(--spacing-3)
```

- [ ] **Step 5: Verify visually**

Run: `cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio && npm run dev` (skip if already running from Task 1).

Use Playwright to navigate to `http://localhost:3000/`, click "Демо-режим" to enter the guest board, take a full-page screenshot.

Expected: no theme toggle button visible in the sidebar footer or mobile menu; no console errors (confirms `useTheme`/`ThemeToggle` removal didn't break an import elsewhere).

- [ ] **Step 6: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add -A
git commit -m "feat(design): remove light/dark theme toggle, app is dark-only now"
```

---

### Task 3: Flatten remaining hardcoded gradients/shadows and dead dark-theme overrides

**Files:**
- Modify: `app/components/layout/Sidebar.vue`
- Modify: `app/components/ui/button/Button.vue`
- Modify: `app/pages/login.vue`
- Modify: `app/components/kanban/KanbanBoard.vue`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Flatten the sidebar logo and avatar gradients**

In `app/components/layout/Sidebar.vue`, change:

```sass
.logo-mark
  width: 32px
  height: 32px
  background: linear-gradient(135deg, var(--color-primary), #0f9b8e)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3)
```

to:

```sass
.logo-mark
  width: 32px
  height: 32px
  background: var(--color-primary)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
```

and change:

```sass
.logo-icon
  color: white
  font-size: 16px
  font-weight: 800
  letter-spacing: -0.5px
  line-height: 1
```

to:

```sass
.logo-icon
  color: var(--color-text-inverse)
  font-size: 16px
  font-weight: 800
  letter-spacing: -0.5px
  line-height: 1
```

and change:

```sass
.user-avatar
  width: 32px
  height: 32px
  border-radius: var(--radius-full)
  background: linear-gradient(135deg, #8b5cf6, #0d9488)
  display: flex
  align-items: center
  justify-content: center
  color: white
  font-size: var(--font-size-sm)
  font-weight: 700
  flex-shrink: 0
```

to:

```sass
.user-avatar
  width: 32px
  height: 32px
  border-radius: var(--radius-full)
  background: var(--color-bg-tertiary)
  border: var(--border-width) solid var(--color-border)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 700
  flex-shrink: 0
```

- [ ] **Step 2: Drop the hardcoded teal shadow on the primary button**

In `app/components/ui/button/Button.vue`, change:

```sass
  &--primary
    background-color: var(--color-button-primary-bg)
    color: var(--color-button-primary-text)
    border-color: var(--color-button-primary-bg)
    box-shadow: 0 1px 3px rgba(13, 148, 136, 0.25)

    &:hover:enabled
      background-color: var(--color-button-primary-bg-hover)
      border-color: var(--color-button-primary-bg-hover)
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.35)
      transform: translateY(-1px)
```

to:

```sass
  &--primary
    background-color: var(--color-button-primary-bg)
    color: var(--color-button-primary-text)
    border-color: var(--color-button-primary-bg)

    &:hover:enabled
      background-color: var(--color-button-primary-bg-hover)
      border-color: var(--color-button-primary-bg-hover)
      transform: translateY(-1px)
```

- [ ] **Step 3: Fold the dead `[data-theme="dark"]` override in login.vue into the base rule**

In `app/pages/login.vue`, change:

```sass
.login__bg-mesh
  position: absolute
  inset: 0
  background: radial-gradient(ellipse 80% 60% at 20% 10%, rgba(13, 148, 136, 0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(14, 165, 233, 0.04) 0%, transparent 60%)

[data-theme="dark"] .login__bg-mesh
  background: radial-gradient(ellipse 80% 60% at 20% 10%, rgba(20, 184, 166, 0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(56, 189, 248, 0.04) 0%, transparent 60%)
```

to:

```sass
.login__bg-mesh
  position: absolute
  inset: 0
  background: none
```

(The mesh background was a colorful glow effect that doesn't fit the flat black aesthetic — removing it entirely rather than recoloring it.)

- [ ] **Step 4: Fold the dead `[data-theme="dark"]` override in KanbanBoard.vue into the base rule**

In `app/components/kanban/KanbanBoard.vue`, change:

```sass
.kanban-demo-badge
  display: inline-flex
  align-items: center
  gap: 6px
  padding: 3px 10px
  background-color: rgba(245, 158, 11, 0.1)
  color: #b45309
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: 700
  letter-spacing: 0.3px
  border: 1px solid rgba(245, 158, 11, 0.2)

[data-theme="dark"] .kanban-demo-badge
  color: #fbbf24
  background-color: rgba(251, 191, 36, 0.1)
  border-color: rgba(251, 191, 36, 0.2)
```

to:

```sass
.kanban-demo-badge
  display: inline-flex
  align-items: center
  gap: 6px
  padding: 3px 10px
  background-color: rgba(255, 154, 68, 0.1)
  color: #ff9a44
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: 700
  letter-spacing: 0.3px
  border: 1px solid rgba(255, 154, 68, 0.2)
```

- [ ] **Step 5: Verify visually**

Use Playwright to screenshot `http://localhost:3000/login` and the guest board (`http://localhost:3000/` after clicking "Демо-режим").

Expected: sidebar logo is a flat white square with black "D", no glow/mesh behind the login card, demo badge is a flat orange pill, no console errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add app/components/layout/Sidebar.vue app/components/ui/button/Button.vue app/pages/login.vue app/components/kanban/KanbanBoard.vue
git commit -m "feat(design): flatten remaining hardcoded gradients and dead theme overrides"
```

---

### Task 4: Rewrite KanbanStats.vue as pill-chips

**Files:**
- Modify: `app/components/kanban/KanbanStats.vue`

**Interfaces:**
- Consumes: `--kanban-doing-color`, `--kanban-done-tracker-color`, `--kanban-wishlist-color`, `--color-text-muted`, `--color-text` (Task 1).
- Produces: nothing consumed by later tasks (this component is a leaf).

- [ ] **Step 1: Replace the price formatter to drop the ₽ symbol**

Change:

```ts
const formatSum = (sum: number) =>
    sum.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})
```

to:

```ts
const formatSum = (sum: number) =>
    sum.toLocaleString('ru-RU', {maximumFractionDigits: 0})
```

- [ ] **Step 2: Replace the template with the chip-row markup**

Replace the entire `<template>` block with:

```html
<template>
  <div v-if="isLoading" class="stats-chips">
    <span v-for="i in 4" :key="i" class="chip chip--skeleton"></span>
  </div>

  <div v-else-if="stats" class="stats-chips">
    <span
        v-for="tile in statTiles"
        :key="tile.id"
        class="chip"
        :class="`chip--${tile.id}`"
    >
      <span class="chip__dot" :class="`chip__dot--${tile.id}`"></span>
      <strong class="chip__value tabular-nums">{{ tile.value }}</strong>
      {{ tile.label }}
    </span>
  </div>
</template>
```

- [ ] **Step 3: Simplify the `statTiles` computed (drop unused `hint`/`icon` fields)**

Change the `StatTile` interface and `statTiles` computed to:

```ts
interface StatTile {
  id: string
  label: string
  value: string
}
```

```ts
const statTiles = computed((): StatTile[] => {
  if (!stats.value) return []

  return [
    {id: 'total', label: 'всего', value: String(stats.value.total)},
    {id: 'doing', label: 'в работе', value: String(stats.value.doing)},
    {id: 'done', label: 'готово', value: String(stats.value.done)},
    {id: 'wishlist', label: 'wishlist', value: formatSum(stats.value.wishlistSum)},
  ]
})
```

- [ ] **Step 4: Replace the entire `<style>` block**

```sass
<style scoped lang="sass">
.stats-chips
  display: flex
  flex-wrap: wrap
  gap: var(--spacing-2)
  margin-bottom: var(--spacing-5)

.chip
  display: inline-flex
  align-items: center
  gap: 6px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-full)
  padding: 5px 12px
  font-size: var(--font-size-xs)
  color: var(--color-text-secondary)

  &--skeleton
    width: 90px
    height: 26px
    background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)
    background-size: 200% 100%
    animation: skeleton-shimmer 1.5s ease infinite
    border-color: transparent

@keyframes skeleton-shimmer
  0%
    background-position: 200% 0
  100%
    background-position: -200% 0

.chip__dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background-color: var(--color-text-muted)

  &--doing
    background-color: var(--kanban-doing-color)

  &--done
    background-color: var(--kanban-done-tracker-color)

  &--wishlist
    background-color: var(--kanban-wishlist-color)

.chip__value
  color: var(--color-text)
  font-weight: 600
  font-family: var(--font-numeric)
</style>
```

- [ ] **Step 5: Verify visually**

Use Playwright to screenshot the guest board (`http://localhost:3000/`).

Expected: under "Мой трекер" there's a row of 4 small pill chips ("11 всего", "2 в работе", "2 готово", "65 000 wishlist" — **no ₽ symbol**), no stat-tile boxes, no console errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add app/components/kanban/KanbanStats.vue
git commit -m "feat(design): replace board stat tiles with compact pill chips"
```

---

### Task 5: Rewrite KanbanCard.vue and KanbanColumn.vue as dense rows

**Files:**
- Modify: `app/components/kanban/KanbanCard.vue`
- Modify: `app/components/kanban/KanbanColumn.vue`

**Interfaces:**
- Consumes: `--kanban-ideas-color` / `--kanban-tasks-color` / `--kanban-doing-color` / `--kanban-done-tracker-color` / `--kanban-wishlist-color` (Task 1); `column.id`, `column.name`, `column.items` (`IColumn`/`ICard` from `kanban.types.ts`, unchanged).
- Produces: `.kanban-card` row element used as-is by `KanbanColumn.vue`; `column-dot--<id>` classes already exist and are reused unchanged.

- [ ] **Step 1: Replace KanbanCard's price formatter to drop the ₽ symbol**

In `app/components/kanban/KanbanCard.vue`, change:

```ts
const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})
```

to:

```ts
const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', {maximumFractionDigits: 0})
```

- [ ] **Step 2: Replace KanbanCard's template with the row markup**

Replace the entire `<template>` block with:

```html
<template>
  <div
      class="kanban-card"
      :class="[
        `kanban-card--${columnId}`,
        { 'kanban-card--dragging': isDragging, 'kanban-card--enter': !isEntered },
      ]"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @animationend="handleEnterAnimationEnd"
      @click="handleOpenSlideover"
      role="button"
      :aria-label="`Карточка: ${card.name}`"
      tabindex="0"
      @keydown.enter="handleOpenSlideover"
  >
    <span class="card-name">{{ card.name }}</span>

    <div class="card-right">
      <span v-if="isWishlistItem" class="card-price tabular-nums">{{ formatPrice(card.price) }}</span>
      <span v-else class="card-dot" :class="`card-dot--${columnId}`"></span>

      <button
          class="card-archive-btn"
          :disabled="isArchiving"
          @click.stop="handleArchive"
          aria-label="В архив"
          title="В архив"
      >
        <Icon name="heroicons:archive-box-arrow-down" size="13"/>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Replace KanbanCard's `<style>` block**

```sass
<style scoped lang="sass">
.kanban-card
  position: relative
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  min-width: 0
  background-color: var(--kanban-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-bottom: none
  padding: 11px 12px
  cursor: pointer
  transition: background-color var(--transition-fast) ease
  user-select: none

  &:first-child
    border-radius: var(--radius-md) var(--radius-md) 0 0

  &:last-child
    border-bottom: var(--border-width) solid var(--color-card-border)
    border-radius: 0 0 var(--radius-md) var(--radius-md)

  &--enter
    opacity: 0
    animation: card-in 0.2s ease forwards

  &:hover
    background-color: var(--color-bg-tertiary)

    .card-archive-btn
      opacity: 1

  &--dragging
    cursor: grabbing
    opacity: 0.6

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: -2px

@keyframes card-in
  from
    opacity: 0
  to
    opacity: 1

.card-name
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)
  min-width: 0
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.card-right
  display: flex
  align-items: center
  gap: var(--spacing-2)
  flex-shrink: 0

.card-price
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-secondary)
  font-family: var(--font-numeric)

.card-dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background-color: var(--color-text-muted)

  &--ideas
    background-color: var(--kanban-ideas-color)

  &--tasks
    background-color: var(--kanban-tasks-color)

  &--doing
    background-color: var(--kanban-doing-color)

  &--done
    background-color: var(--kanban-done-tracker-color)

  &--wishlist
    background-color: var(--kanban-wishlist-color)

.card-archive-btn
  width: 20px
  height: 20px
  display: flex
  align-items: center
  justify-content: center
  background: none
  border: none
  border-radius: var(--radius-sm)
  color: var(--color-text-muted)
  cursor: pointer
  opacity: 0
  transition: all var(--transition-fast) ease
  padding: 0

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-danger)
</style>
```

- [ ] **Step 4: Remove the now-unused `category`/`priority` styling hooks from KanbanCard's script**

Delete these now-unused lines (the row no longer shows a category badge or a priority pill):

```ts
const CATEGORY_COLORS: Record<string, string> = {
  'Идея': 'category--idea',
  'Задача': 'category--task',
  'Wishlist': 'category--wish',
}

const categoryClass = computed(() => CATEGORY_COLORS[props.card.category] ?? '')
```

Keep `isWishlistItem`, `formatDate`, `formatPrice`, and all drag/archive/slideover handlers — they're still used.

- [ ] **Step 5: Replace KanbanColumn's column-header and column-content markup**

In `app/components/kanban/KanbanColumn.vue`, replace:

```html
    <div class="column-header">
      <div class="column-header__left">
        <span class="column-dot" :class="`column-dot--${column.id}`"></span>
        <h2 class="column-title">{{ column.name }}</h2>
      </div>
      <span class="column-count">{{ column.items.length }}</span>
    </div>

    <CreateCard :status="column.id" @card-created="onCardCreated"/>

    <div class="column-content">
      <div v-if="isPending" class="loading-indicator">
        <div class="spinner-mini"></div>
        <span>Перемещение...</span>
      </div>

      <KanbanCard
          v-for="(card, index) in column.items"
          :key="card.id"
          :card="card"
          :column-id="column.id"
          :is-dragging="dragCard?.id === card.id"
          :style="{ animationDelay: `${index * 40}ms` }"
          @dragstart="handleDragStart(card, column)"
          @dragend="handleDragEnd"
      />

      <div v-if="column.items.length === 0 && !isPending" class="empty-column">
        <Icon name="heroicons:inbox" size="20" class="empty-icon"/>
        <span>Пусто</span>
      </div>
    </div>
```

with:

```html
    <div class="column-header">
      <h2 class="column-title">{{ column.name }}</h2>
      <span class="column-count">{{ column.items.length }}</span>
    </div>

    <div class="column-content">
      <div v-if="isPending" class="loading-indicator">
        <div class="spinner-mini"></div>
        <span>Перемещение...</span>
      </div>

      <KanbanCard
          v-for="(card, index) in column.items"
          :key="card.id"
          :card="card"
          :column-id="column.id"
          :is-dragging="dragCard?.id === card.id"
          :style="{ animationDelay: `${index * 40}ms` }"
          @dragstart="handleDragStart(card, column)"
          @dragend="handleDragEnd"
      />

      <div v-if="column.items.length === 0 && !isPending" class="empty-column">
        <Icon name="heroicons:inbox" size="20" class="empty-icon"/>
        <span>Пусто</span>
      </div>
    </div>

    <CreateCard :status="column.id" @card-created="onCardCreated"/>
```

(This drops the colored dot next to the column title — color now lives only on each row's dot — and moves "+ Добавить" below the list, matching the approved mockup.)

- [ ] **Step 6: Replace KanbanColumn's `<style>` block**

```sass
<style scoped lang="sass">
.kanban-column
  width: 220px
  flex-shrink: 0
  display: flex
  flex-direction: column

  &--over
    .column-content
      outline: 1px dashed var(--color-border-hover)
      outline-offset: 4px
      border-radius: var(--radius-md)

.column-header
  display: flex
  justify-content: space-between
  align-items: center
  margin-bottom: var(--spacing-2)
  padding: 0 2px

.column-title
  margin: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)

.column-count
  font-size: var(--font-size-xs)
  font-weight: 500
  color: var(--color-text-muted)
  font-variant-numeric: tabular-nums

.column-content
  display: flex
  flex-direction: column

.empty-column
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-6) var(--spacing-3)
  min-height: 88px
  border: 1.5px dashed var(--color-border)
  border-radius: var(--radius-md)
  color: var(--color-text-muted)
  font-size: var(--font-size-sm)
  font-weight: 500

  .empty-icon
    opacity: 0.4

.loading-indicator
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-3)
  color: var(--color-text-secondary)
  font-size: var(--font-size-xs)
  font-weight: 500

.spinner-mini
  width: 14px
  height: 14px
  border: 2px solid var(--color-border)
  border-top: 2px solid var(--color-primary)
  border-radius: 50%
  animation: spin 0.8s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)
</style>
```

- [ ] **Step 7: Update CreateCard's trigger button to look like the dashed "+ Добавить" row from the mockup**

In `app/components/kanban/CreateCard.vue`, change:

```sass
.create-card
  margin-bottom: var(--spacing-3)
```

to:

```sass
.create-card
  margin-top: var(--spacing-2)
```

(Leave the rest of `CreateCard.vue` untouched — its existing dashed-border trigger button already matches the approved style once it reads the new tokens from Task 1.)

- [ ] **Step 8: Verify visually**

Use Playwright to screenshot the guest board (`http://localhost:3000/`), and open the browser devtools-free check by reading the page text content for `₽` (it must not appear anywhere on the Wishlist column).

Expected: each column renders as a list of thin bordered rows (not block cards), with a colored dot on the right of each row except Wishlist rows which show a price instead, "+ Добавить" sits below the list, no `₽` symbol anywhere, no console errors. Click one card to confirm the slideover still opens (logic untouched).

- [ ] **Step 9: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add app/components/kanban/KanbanCard.vue app/components/kanban/KanbanColumn.vue app/components/kanban/CreateCard.vue
git commit -m "feat(design): rewrite kanban card/column as dense Vercel-style rows"
```

---

### Task 6: Simplify UnderDevelopment.vue

**Files:**
- Modify: `app/components/ui/UnderDevelopment.vue`

**Interfaces:**
- Consumes: `title`, `description` props (unchanged, still passed by `dashboard.vue`/`help.vue`/`ideas.vue`/`tasks.vue`/`wishlist.vue` — do not change those pages).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace the entire `<template>` block**

```html
<template>
  <div class="ud-wrapper">
    <div class="ud-icon-wrap">
      <Icon name="heroicons:wrench-screwdriver" class="ud-icon"/>
    </div>

    <h2 class="ud-title">{{ title }}</h2>
    <p class="ud-description">{{ description }}</p>
  </div>
</template>
```

- [ ] **Step 2: Replace the entire `<style>` block**

```sass
<style scoped lang="sass">
.ud-wrapper
  flex: 1
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-4)
  min-height: 0
  width: 100%
  padding: var(--spacing-8)
  text-align: center
  background-color: var(--color-bg)

.ud-icon-wrap
  display: flex
  align-items: center
  justify-content: center
  width: 48px
  height: 48px
  border-radius: var(--radius-md)
  background-color: var(--color-bg-secondary)
  border: var(--border-width) solid var(--color-border)
  color: var(--color-text-muted)

.ud-icon
  width: 22px
  height: 22px

.ud-title
  font-size: var(--font-size-lg)
  font-weight: 600
  color: var(--color-text)
  margin: 0

.ud-description
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  margin: 0
  max-width: 36ch
</style>
```

(This drops the blurred backdrop skeleton table/chart and the frosted-glass card entirely, per the approved mockup — just an icon, title, and description centered on the plain dark background.)

- [ ] **Step 3: Verify visually**

Use Playwright to navigate to `http://localhost:3000/dashboard` (one of the stub pages) and take a screenshot.

Expected: centered icon in a small bordered box, title, description, plain black background — no blurred mock table, no frosted glass panel, no console errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add app/components/ui/UnderDevelopment.vue
git commit -m "feat(design): simplify the in-development stub screen"
```

---

### Task 7: Full-app visual review

**Files:** none (verification-only task).

**Interfaces:**
- Consumes: all of the above.
- Produces: nothing (terminal task).

- [ ] **Step 1: Start the dev server if not already running**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio && npm run dev
```

- [ ] **Step 2: Screenshot every changed screen**

Using Playwright (`mcp__playwright__browser_navigate` + `mcp__playwright__browser_take_screenshot` with `fullPage: true`), visit and screenshot each of:

1. `http://localhost:3000/login`
2. `http://localhost:3000/` after clicking "Демо-режим" (the board)
3. `http://localhost:3000/dashboard` (UnderDevelopment stub)
4. `http://localhost:3000/archive`
5. `http://localhost:3000/settings`

- [ ] **Step 3: Check each screenshot against the spec's criteria**

For every screenshot, confirm:
- Background is black/near-black, no gradient fills anywhere.
- No light/dark theme toggle is visible anywhere in the UI.
- No `₽` symbol appears anywhere a price is shown.
- Numbers (counts, prices) are visually in a monospace font.
- The kanban board (screen 2) shows dense bordered rows per column, with the pill-chip metrics row above it.

If any screenshot fails a criterion, go back to the relevant task, fix it, take a new screenshot, and re-check before proceeding.

- [ ] **Step 4: Run the production build to confirm no build-time errors**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio && npm run build
```

Expected: build completes successfully (exit code 0). Pre-existing TS errors in `app/pages/orders.vue` are out of scope per the spec — if the build fails, confirm the failure is unrelated to this redesign (e.g. still the same pre-existing errors) before treating it as a regression.

- [ ] **Step 5: Final commit**

```bash
cd /Users/artyom/WebstormProjects/educational-projects/projects/dealio
git add -A
git status
```

If there are no uncommitted changes (every task already committed its own work), nothing to do here — this step is just the final confirmation that the working tree is clean.

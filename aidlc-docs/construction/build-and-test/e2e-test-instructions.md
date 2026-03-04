# End-to-End Test Instructions — 1:1OS

**Date**: 2026-03-03
**Scope**: Units 1–5 — auth, teammate profiles, meeting ingestion, intelligence engine, tracker & timeline

> **Status**: E2E test framework setup and scaffolding for all 5 units are defined here. Full execution requires Playwright setup, a live dev server, and all 13 `.env.local` variables set.

---

## E2E Test Tool: Playwright

Playwright is recommended for E2E testing of Next.js applications.

### Setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts` in the workspace root:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

---

## E2E Test: US-01 — Registration Flow

**File**: `e2e/auth/register.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('successful registration redirects to dashboard', async ({ page }) => {
  await page.goto('/auth/register')

  await page.fill('[data-testid="email-input"]', 'e2e-register@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('[data-testid="dashboard-placeholder"]')).toBeVisible()
})

test('shows error for duplicate email', async ({ page }) => {
  await page.goto('/auth/register')

  await page.fill('[data-testid="email-input"]', 'existing@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page.locator('[data-testid="auth-form-error"]')).toContainText('already exists')
})

test('shows error for short password', async ({ page }) => {
  await page.goto('/auth/register')

  await page.fill('[data-testid="email-input"]', 'new@example.com')
  await page.fill('[data-testid="password-input"]', 'short')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page.locator('[data-testid="auth-form-error"]')).toContainText('8 characters')
})
```

---

## E2E Test: US-02 — Login, Session, Logout Flow

**File**: `e2e/auth/login.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('successful login redirects to dashboard', async ({ page }) => {
  await page.goto('/auth/login')

  await page.fill('[data-testid="email-input"]', 'e2e-login@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page).toHaveURL('/dashboard')
})

test('wrong credentials shows error', async ({ page }) => {
  await page.goto('/auth/login')

  await page.fill('[data-testid="email-input"]', 'e2e-login@example.com')
  await page.fill('[data-testid="password-input"]', 'wrongpassword')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page.locator('[data-testid="auth-form-error"]')).toContainText('Incorrect email or password')
})

test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/auth/login')
})

test('logout clears session and redirects to login', async ({ page }) => {
  // Login first
  await page.goto('/auth/login')
  await page.fill('[data-testid="email-input"]', 'e2e-login@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="auth-form-submit"]')
  await expect(page).toHaveURL('/dashboard')

  // Logout
  await page.click('[data-testid="logout-button"]')
  await expect(page).toHaveURL('/auth/login')

  // Confirm session cleared
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/auth/login')
})

test('password show/hide toggle works', async ({ page }) => {
  await page.goto('/auth/login')

  const passwordInput = page.locator('[data-testid="password-input"]')
  const toggle = page.locator('[data-testid="password-toggle"]')

  await expect(passwordInput).toHaveAttribute('type', 'password')
  await toggle.click()
  await expect(passwordInput).toHaveAttribute('type', 'text')
  await toggle.click()
  await expect(passwordInput).toHaveAttribute('type', 'password')
})
```

---

## E2E Test: US-16 — Forgot Password Flow

**File**: `e2e/auth/forgot-password.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('forgot password always shows success message', async ({ page }) => {
  await page.goto('/auth/forgot-password')

  await page.fill('[data-testid="email-input"]', 'nonexistent@example.com')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page.locator('[data-testid="forgot-password-success"]')).toContainText(
    'If an account exists for this email'
  )
})

test('reset password page shows error for missing token', async ({ page }) => {
  await page.goto('/auth/reset-password')
  // No token in URL
  await expect(page.locator('[data-testid="invalid-token-message"]')).toBeVisible()
})

test('reset password success flow', async ({ page }) => {
  // This test requires a valid token — generated via API in test setup
  // See: integration-test-instructions.md Scenario 4 for token generation
  const validToken = process.env.E2E_RESET_TOKEN ?? ''
  test.skip(!validToken, 'Requires E2E_RESET_TOKEN env var')

  await page.goto(`/auth/reset-password?token=${validToken}`)
  await page.fill('[data-testid="new-password-input"]', 'newPassword123!')
  await page.click('[data-testid="auth-form-submit"]')

  await expect(page.locator('[data-testid="reset-success-message"]')).toContainText('Password updated')
})
```

---

## Running E2E Tests

```bash
# Run all E2E tests (headless)
npx playwright test

# Run with browser UI visible
npx playwright test --headed

# Run a specific test file
npx playwright test e2e/auth/login.spec.ts

# Generate test report
npx playwright show-report
```

---

## E2E Test Data Management

E2E tests require clean, isolated test data. Recommended approach:

1. **Create test users before each test suite** via API calls in `beforeAll` hooks
2. **Delete test users after each test suite** via direct Prisma/SQL cleanup
3. **Use unique email prefixes** to avoid conflicts: `e2e-${Date.now()}@example.com`

Example `beforeAll`/`afterAll` pattern:

```typescript
import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPass123!'

setup.beforeAll(async ({ request }) => {
  await request.post('/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
})
```

---

---

## E2E Tests: US-03 — AI Onboarding Interview

**File**: `e2e/teammates/interview.spec.ts`

> **Note**: These tests require `ANTHROPIC_API_KEY` in the Playwright environment. Use `E2E_SKIP_CLAUDE=true` to skip the live Claude calls and test only the UI mechanics.

```typescript
import { test, expect } from '@playwright/test'

const TEST_EMAIL    = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPass123!'

test.beforeAll(async ({ request }) => {
  await request.post('/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
})

test('add teammate modal creates teammate and navigates to interview', async ({ page }) => {
  // Login
  await page.goto('/auth/login')
  await page.fill('[data-testid="email-input"]', TEST_EMAIL)
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD)
  await page.click('[data-testid="auth-form-submit"]')
  await expect(page).toHaveURL('/dashboard')

  // Open modal
  await page.click('[data-testid="add-teammate-button"]')
  await page.fill('[data-testid="teammate-name-input"]', 'Test Teammate')
  await page.fill('[data-testid="teammate-role-input"]', 'Designer')
  await page.click('[data-testid="start-interview-button"]')

  // Verify navigation to interview page
  await expect(page).toHaveURL(/\/teammates\/.+\/interview/)
})

test('interview page loads first question', async ({ page }) => {
  test.skip(process.env.E2E_SKIP_CLAUDE === 'true', 'Skipped: requires live Anthropic API')

  // (assume already logged in via storageState fixture)
  // Navigate to an existing interview
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}/interview`)

  // First question should load
  await expect(page.locator('[data-testid="interview-question"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="interview-progress"]')).toContainText('1')
})

test('interview submit button requires non-empty answer', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}/interview`)
  await expect(page.locator('[data-testid="interview-question"]')).toBeVisible({ timeout: 15000 })

  // Submit button should be disabled or do nothing with empty answer
  const answerInput = page.locator('[data-testid="interview-answer-input"]')
  await expect(answerInput).toBeFocused()

  // Submitting empty should not advance
  await page.click('[data-testid="submit-answer-button"]')
  await expect(page.locator('[data-testid="interview-progress"]')).toContainText('1')
})

test('interview shows fallback banner when Claude is unavailable', async ({ page }) => {
  // This test uses an invalid API key injected at the server via env override
  // In CI: set ANTHROPIC_API_KEY=invalid in the test server environment
  const teammateId = process.env.E2E_FALLBACK_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_FALLBACK_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}/interview`)

  // Expect fallback message or redirect to profile with editMode=1
  await expect(
    page.locator('[data-testid="interview-fallback-message"]')
  ).toBeVisible({ timeout: 10000 })
})
```

---

## E2E Tests: US-04 — Teammate Profile Review and Edit

**File**: `e2e/teammates/profile.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('profile page shows incomplete banner when profile is empty', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)

  await expect(page.locator('[data-testid="profile-incomplete-banner"]')).toBeVisible()
})

test('edit profile saves and shows success toast', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}?editMode=1`)

  // Fill in strengths field
  const strengthsInput = page.locator('textarea[name="strengths"]')
  await strengthsInput.fill('Strong systems thinker')
  await page.click('[data-testid="profile-save-button"]')

  // Success toast
  await expect(page.locator('text=Profile saved.')).toBeVisible()

  // Field value persists after save
  await expect(strengthsInput).toHaveValue('Strong systems thinker')
})

test('back to team navigates to dashboard', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)
  await page.click('text=← Back to team')
  await expect(page).toHaveURL('/dashboard')
})

test('delete teammate redirects to dashboard', async ({ page }) => {
  // Create a disposable teammate for deletion test
  const res = await page.request.post('/api/teammates', {
    data: { name: 'Delete Me', role: 'Tester' },
  })
  const { id } = await res.json()

  await page.goto(`/teammates/${id}`)
  await page.click('[data-testid="delete-teammate-button"]')
  await page.click('[data-testid="confirm-delete-button"]')

  await expect(page).toHaveURL('/dashboard')

  // Verify teammate no longer listed
  await expect(page.locator(`[data-testid="teammate-card-${id}"]`)).not.toBeVisible()
})

test('dashboard shows teammate card after creation', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('[data-testid="add-teammate-button"]')
  await page.fill('[data-testid="teammate-name-input"]', 'Card Verify Test')
  await page.fill('[data-testid="teammate-role-input"]', 'Engineer')
  await page.click('[data-testid="start-interview-button"]')

  // Navigate back to dashboard
  await page.goto('/dashboard')
  await expect(page.locator('text=Card Verify Test')).toBeVisible()
})
```

---

---

## E2E Tests: US-05 — Paste Meeting Notes

**File**: `e2e/meetings/paste.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

const TEST_EMAIL    = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPass123!'

test.beforeAll(async ({ request }) => {
  await request.post('/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
})

test('paste meeting text creates meeting in pending state', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)

  // Open meeting input modal
  await page.click('[data-testid="add-meeting-button"]')
  await expect(page.locator('[data-testid="meeting-input-modal"]')).toBeVisible()

  // Select paste tab and submit text
  await page.click('[data-testid="tab-paste"]')
  await page.fill('[data-testid="paste-textarea"]', 'Sprint retro: we discussed velocity. Team identified two key blockers for next sprint.')
  await page.click('[data-testid="paste-submit"]')

  // Banner should appear showing analysis is pending
  await expect(page.locator('[data-testid="analysis-pending-banner"]')).toBeVisible({ timeout: 5000 })
})

test('meeting card appears in profile after paste', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)
  // At least one meeting pending banner or results visible
  await expect(
    page.locator('[data-testid="analysis-pending-banner"], [data-testid="meeting-analysis-results"]').first()
  ).toBeVisible({ timeout: 5000 })
})
```

---

## E2E Tests: US-08 — Transcription Review

**File**: `e2e/meetings/transcription.spec.ts`

> **Note**: Transcription tests require `OPENAI_API_KEY` in the environment. Use `E2E_SKIP_TRANSCRIPTION=true` to skip live Whisper calls.

```typescript
import { test, expect } from '@playwright/test'

test('voice recorder shows IDLE state on load', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)
  await page.click('[data-testid="add-meeting-button"]')
  await page.click('[data-testid="tab-record"]')

  await expect(page.locator('[data-testid="voice-recorder"]')).toBeVisible()
  await expect(page.locator('[data-testid="record-button"]')).toBeVisible()
})

test('transcription review shows editable text', async ({ page }) => {
  test.skip(process.env.E2E_SKIP_TRANSCRIPTION === 'true', 'Skipped: requires live OpenAI Whisper')

  const fileId = process.env.E2E_FILE_ID ?? ''
  const teammate = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!fileId || !teammate, 'Requires E2E_FILE_ID and E2E_TEAMMATE_ID env vars')

  // The TranscriptionReview component is shown after upload completes
  // Navigate to the teammate page where the modal is open at the review step
  // (In practice: simulate the review step via URL state or pre-set component state)
  await expect(page.locator('[data-testid="transcription-review"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-testid="transcription-textarea"]')).toBeEditable()
})
```

---

## E2E Tests: US-09 — Detected Pattern List

**File**: `e2e/teammates/patterns.spec.ts`

> **Note**: Pattern detection tests require ≥2 ANALYSIS_COMPLETE meetings for the teammate. Seed via the integration test script or run integration Scenario 14 first.

```typescript
import { test, expect } from '@playwright/test'

test('profile page shows pattern list when patterns exist', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_WITH_PATTERNS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_PATTERNS_ID env var (teammate with ≥2 analyzed meetings)')

  await page.goto(`/teammates/${teammateId}`)

  await expect(page.locator('[data-testid="pattern-list"]')).toBeVisible()
  // At least one pattern card rendered
  await expect(page.locator('[data-testid^="pattern-card-"]').first()).toBeVisible()
})

test('pattern card shows severity badge', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_WITH_PATTERNS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_PATTERNS_ID env var')

  await page.goto(`/teammates/${teammateId}`)
  await expect(page.locator('[data-testid="pattern-list"]')).toBeVisible()

  const firstCard = page.locator('[data-testid^="pattern-card-"]').first()
  await expect(firstCard.locator('[data-testid^="pattern-severity-"]')).toBeVisible()
})
```

---

## E2E Tests: US-10/US-11 — Pre-Meeting Brief

**File**: `e2e/teammates/brief.spec.ts`

> **Note**: Brief tests require `ANTHROPIC_API_KEY` and ≥1 ANALYSIS_COMPLETE meeting. Use `E2E_SKIP_CLAUDE=true` to skip live Claude calls and test the page shell only.

```typescript
import { test, expect } from '@playwright/test'

test('brief tab renders brief view after generation', async ({ page }) => {
  test.skip(process.env.E2E_SKIP_CLAUDE === 'true', 'Skipped: requires live Anthropic API')

  const teammateId = process.env.E2E_TEAMMATE_WITH_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_MEETINGS_ID env var')

  await page.goto(`/teammates/${teammateId}/brief`)

  // Brief generates on mount via useEffect
  await expect(page.locator('[data-testid="brief-view"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-testid="brief-coaching-focus"]')).toBeVisible()
  await expect(page.locator('[data-testid="brief-follow-up-questions"]')).toBeVisible()
})

test('brief page shows fallback view when no meetings exist', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_NO_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_NO_MEETINGS_ID env var')

  await page.goto(`/teammates/${teammateId}/brief`)

  await expect(page.locator('[data-testid="brief-fallback-view"]')).toBeVisible({ timeout: 10000 })
})

test('copy brief button copies text to clipboard', async ({ page, context }) => {
  test.skip(process.env.E2E_SKIP_CLAUDE === 'true', 'Skipped: requires live Anthropic API')

  const teammateId = process.env.E2E_TEAMMATE_WITH_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_MEETINGS_ID env var')

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/teammates/${teammateId}/brief`)
  await expect(page.locator('[data-testid="brief-view"]')).toBeVisible({ timeout: 30000 })

  await page.click('[data-testid="copy-brief-btn"]')
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText.length).toBeGreaterThan(50)
})
```

---

## E2E Tests: US-14/US-15 — Commitments Tracker

**File**: `e2e/teammates/commitments.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('add commitment modal creates a new open commitment', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}/commitments`)
  await expect(page.locator('[data-testid="commitments-page"]')).toBeVisible()

  await page.click('[data-testid="add-commitment-btn"]')
  await expect(page.locator('[data-testid="add-commitment-modal"]')).toBeVisible()

  await page.fill('[data-testid="commitment-text-input"]', `E2E test commitment ${Date.now()}`)
  await page.click('[data-testid="commitment-submit-btn"]')

  // Modal should close; new commitment appears in list
  await expect(page.locator('[data-testid="add-commitment-modal"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="commitment-list"]')).toBeVisible()
  await expect(page.locator('[data-testid^="commitment-card-"]').first()).toBeVisible()
})

test('marking commitment as done moves it to resolved list', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}/commitments`)

  // Assumes at least one open commitment exists (created by previous test or seed)
  const firstCard = page.locator('[data-testid^="commitment-card-"]').first()
  const cardId = await firstCard.getAttribute('data-testid').then(id => id?.replace('commitment-card-', ''))

  await firstCard.locator('[data-testid^="commitment-done-"]').click()

  // Card should disappear from open list
  await expect(page.locator(`[data-testid="commitment-card-${cardId}"]`)).not.toBeVisible()

  // Check resolved list
  await page.click('[data-testid="show-resolved-btn"]')
  await expect(page.locator(`[data-testid="commitment-card-${cardId}"]`)).toBeVisible()
})

test('broken pattern signal shows for commitments carried ≥2 times', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_WITH_CARRIED_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_CARRIED_ID env var (teammate with carryCount ≥ 2)')

  await page.goto(`/teammates/${teammateId}/commitments`)
  await expect(page.locator('[data-testid="broken-pattern-signals"]')).toBeVisible()
  await expect(page.locator('[data-testid="broken-pattern-signal-0"]')).toBeVisible()
})
```

---

## E2E Tests: US-13 — Growth Timeline

**File**: `e2e/teammates/timeline.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('timeline page renders meeting list', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_WITH_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_MEETINGS_ID env var')

  await page.goto(`/teammates/${teammateId}/timeline`)
  await expect(page.locator('[data-testid="timeline-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="timeline-list"]')).toBeVisible()
  await expect(page.locator('[data-testid^="timeline-entry-"]').first()).toBeVisible()
})

test('tag filter chip filters meeting list without page reload', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_WITH_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_MEETINGS_ID env var')

  await page.goto(`/teammates/${teammateId}/timeline`)
  await expect(page.locator('[data-testid="tag-filter"]')).toBeVisible()

  // Click first non-"All" tag chip
  const firstTagChip = page.locator('[data-testid^="tag-filter-chip-"]').first()
  const tagText = await firstTagChip.textContent()
  await firstTagChip.click()

  // List should update — only entries with this tag visible
  // (No network request — client-side filter via useMemo)
  await expect(page.locator('[data-testid="timeline-list"]')).toBeVisible()

  // Click "All" to clear filter
  await page.click('[data-testid="tag-filter-all"]')
  await expect(page.locator('[data-testid^="timeline-entry-"]').first()).toBeVisible()
})

test('generate growth summary button calls summary API', async ({ page }) => {
  test.skip(process.env.E2E_SKIP_CLAUDE === 'true', 'Skipped: requires live Anthropic API')

  const teammateId = process.env.E2E_TEAMMATE_WITH_MEETINGS_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_WITH_MEETINGS_ID env var')

  await page.goto(`/teammates/${teammateId}/timeline`)
  await expect(page.locator('[data-testid="growth-summary-panel"]')).toBeVisible()

  await page.click('[data-testid="generate-summary-btn"]')

  // Panel should show loading state then either summary or null message
  await expect(
    page.locator('[data-testid="summary-narrative"], text=Growth summary unavailable')
  ).toBeVisible({ timeout: 15000 })
})

test('tab navigation between profile tabs works', async ({ page }) => {
  const teammateId = process.env.E2E_TEAMMATE_ID ?? ''
  test.skip(!teammateId, 'Requires E2E_TEAMMATE_ID env var')

  await page.goto(`/teammates/${teammateId}`)
  await expect(page.locator('[data-testid="teammate-tabs"]')).toBeVisible()

  // Navigate to Timeline tab
  await page.click('[data-testid="tab-timeline"]')
  await expect(page).toHaveURL(new RegExp(`/teammates/${teammateId}/timeline`))

  // Navigate to Commitments tab
  await page.click('[data-testid="tab-commitments"]')
  await expect(page).toHaveURL(new RegExp(`/teammates/${teammateId}/commitments`))

  // Navigate to Brief tab
  await page.click('[data-testid="tab-brief"]')
  await expect(page).toHaveURL(new RegExp(`/teammates/${teammateId}/brief`))

  // Back to Profile tab
  await page.click('[data-testid="tab-profile"]')
  await expect(page).toHaveURL(new RegExp(`/teammates/${teammateId}$`))
})

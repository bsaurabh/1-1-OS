# Frontend Components — Unit 1: Foundation

**Date**: 2026-03-01

---

## Component Hierarchy

```
pages/
├── auth/
│   ├── login.tsx          → LoginPage
│   ├── register.tsx       → RegisterPage
│   ├── forgot-password.tsx→ ForgotPasswordPage
│   └── reset-password.tsx → ResetPasswordPage
├── dashboard/
│   └── index.tsx          → DashboardPage (shell — no content in Unit 1)
├── _app.tsx               → AppShell (global layout wrapper)
└── index.tsx              → Root redirect (→ /dashboard or /auth/login)

components/
└── auth/
    ├── AuthForm.tsx        → Shared form wrapper
    └── PasswordInput.tsx   → Password field with show/hide toggle

lib/
└── withAuth.ts            → HOC — redirects unauthenticated users to /auth/login
```

---

## Component Definitions

---

### 1. LoginPage (`pages/auth/login.tsx`)

**Purpose**: Renders the login form and handles login submission.

**Props**: none (Next.js page)

**State**:
| State Variable | Type    | Initial | Description                        |
|----------------|---------|---------|------------------------------------|
| `email`        | string  | `""`    | Controlled input value             |
| `password`     | string  | `""`    | Controlled input value             |
| `error`        | string  | `""`    | Server error message to display    |
| `isLoading`    | boolean | `false` | Disables form during submission    |

**User Interactions**:
1. User enters email and password
2. User submits form (button click or Enter key)
3. `isLoading` set to `true`; form disabled
4. `POST /api/auth/login` called with `{ email, password }`
5. On success: redirect to `/dashboard`
6. On error: display error message (e.g., "Incorrect email or password.")

**Validation** (client-side, pre-submit):
- Email: non-empty, valid format
- Password: non-empty
- Client validation does NOT enforce 8-char minimum on login (server handles auth errors)

**API Integration**:
- `POST /api/auth/login` → `{ email, password }` → sets `session` cookie
- On 401: show `error` from response body

**Subcomponents used**:
- `AuthForm` (wrapper)
- `PasswordInput` (password field)

**Links**:
- "Forgot password?" → `/auth/forgot-password`
- "Sign up" → `/auth/register`

---

### 2. RegisterPage (`pages/auth/register.tsx`)

**Purpose**: Renders the registration form and handles account creation.

**Props**: none

**State**:
| State Variable | Type    | Initial | Description                        |
|----------------|---------|---------|------------------------------------|
| `email`        | string  | `""`    |                                    |
| `password`     | string  | `""`    |                                    |
| `error`        | string  | `""`    | Server-side error                  |
| `isLoading`    | boolean | `false` |                                    |

**User Interactions**:
1. User enters email and password
2. Client validates: email format, password >= 8 chars
3. Submit → `POST /api/auth/register`
4. On success: redirect to `/dashboard` (onboarding in Unit 2)
5. On error: display error (e.g., "An account with this email already exists.")

**Validation** (client-side):
- Email: non-empty + RFC 5322 format
- Password: minimum 8 characters (inline hint displayed: "At least 8 characters")

**API Integration**:
- `POST /api/auth/register` → `{ email, password }` → sets `session` cookie

**Subcomponents used**:
- `AuthForm`
- `PasswordInput`

**Links**:
- "Already have an account? Log in" → `/auth/login`

---

### 3. ForgotPasswordPage (`pages/auth/forgot-password.tsx`)

**Purpose**: Collects manager email and triggers password reset email.

**Props**: none

**State**:
| State Variable  | Type    | Initial | Description                                           |
|-----------------|---------|---------|-------------------------------------------------------|
| `email`         | string  | `""`    |                                                       |
| `submitted`     | boolean | `false` | True after successful submission — shows success UI   |
| `error`         | string  | `""`    |                                                       |
| `isLoading`     | boolean | `false` |                                                       |

**User Interactions**:
1. User enters email and submits
2. `POST /api/auth/forgot-password` called
3. Regardless of server outcome: `submitted = true`
4. Success UI shown: "If an account exists for this email, a reset link has been sent."
5. No retry button shown (prevents enumeration timing analysis by user)

**Note**: The success message is always shown post-submission to prevent email enumeration. Even if the API returns an error (network failure), the UI shows the same message (fail silently on client).

**API Integration**:
- `POST /api/auth/forgot-password` → `{ email }`

**Links**:
- "Back to login" → `/auth/login`

---

### 4. ResetPasswordPage (`pages/auth/reset-password.tsx`)

**Purpose**: Collects new password using the token from the reset link URL.

**Props**: none (token read from `router.query.token`)

**State**:
| State Variable  | Type    | Initial | Description                                 |
|-----------------|---------|---------|---------------------------------------------|
| `password`      | string  | `""`    | New password input                          |
| `token`         | string  | `""`    | Extracted from URL query param on mount     |
| `error`         | string  | `""`    | Server error (expired, already used, etc.)  |
| `success`       | boolean | `false` | True after successful reset                 |
| `isLoading`     | boolean | `false` |                                             |

**User Interactions**:
1. Page loads: extract `token` from `?token=` query param
2. If no token in URL: show error "Invalid reset link." (no form rendered)
3. User enters new password (min 8 chars, shown inline)
4. Submit → `POST /api/auth/reset-password` → `{ token, newPassword }`
5. On success: show "Password updated. Please log in." + link to `/auth/login`
6. On error: show error message (e.g., "This link has expired.", "This link is no longer valid.")

**Validation** (client-side):
- Password: minimum 8 characters

**API Integration**:
- `POST /api/auth/reset-password` → `{ token, newPassword }`

---

### 5. DashboardPage (`pages/dashboard/index.tsx`)

**Purpose**: Placeholder shell for authenticated landing page. No content in Unit 1.

**Props**: none

**Auth**: Protected via `withAuth` HOC

**State**: none

**Content in Unit 1**:
- Displays: "Dashboard — coming soon"
- Renders `AppLayout` (navbar with user email + logout button)

**Note**: Full dashboard content built in Units 2–5.

---

### 6. AuthForm (`components/auth/AuthForm.tsx`)

**Purpose**: Shared wrapper for authentication forms providing consistent layout, heading, and submit button.

**Props**:
| Prop         | Type              | Required | Description                                 |
|--------------|-------------------|----------|---------------------------------------------|
| `title`      | string            | Yes      | Form heading (e.g., "Sign in to your account") |
| `onSubmit`   | (e: FormEvent) => void | Yes | Form submit handler                    |
| `isLoading`  | boolean           | Yes      | Disables submit button when true            |
| `submitLabel`| string            | Yes      | Button label (e.g., "Sign in", "Create account") |
| `error`      | string            | No       | Error message displayed above submit button |
| `children`   | React.ReactNode   | Yes      | Form fields (inputs)                        |

**Renders**:
- `<form>` wrapper with `onSubmit`
- `<h1>` title
- `children` (form fields injected by parent page)
- Error alert block (if `error` is non-empty)
- Submit button (disabled + shows spinner when `isLoading`)

**State**: none (stateless)

---

### 7. PasswordInput (`components/auth/PasswordInput.tsx`)

**Purpose**: Password field with show/hide toggle for improved UX.

**Props**:
| Prop          | Type                       | Required | Description                        |
|---------------|----------------------------|----------|------------------------------------|
| `id`          | string                     | Yes      | HTML id for label association      |
| `label`       | string                     | Yes      | Field label text                   |
| `value`       | string                     | Yes      | Controlled value                   |
| `onChange`    | (e: ChangeEvent) => void   | Yes      | Change handler                     |
| `disabled`    | boolean                    | No       | Disables field (default: false)    |
| `hint`        | string                     | No       | Hint text below field (e.g., "At least 8 characters") |
| `autoComplete`| string                     | No       | e.g., `"current-password"`, `"new-password"` |

**State**:
| State Variable | Type    | Initial  | Description              |
|----------------|---------|----------|--------------------------|
| `showPassword` | boolean | `false`  | Toggles input type       |

**Behavior**:
- Input type toggles between `"password"` and `"text"` based on `showPassword`
- Toggle button renders an eye icon (show) or eye-off icon (hide)
- Toggle button: `type="button"` (prevents accidental form submit)
- `aria-label` on toggle button updates to "Show password" / "Hide password"

---

### 8. AppLayout (`components/layout/AppLayout.tsx`)

**Purpose**: Global layout for authenticated pages. Renders navigation bar with manager identity and logout.

**Props**:
| Prop       | Type            | Required | Description                      |
|------------|-----------------|----------|----------------------------------|
| `children` | React.ReactNode | Yes      | Page content                     |

**State**: none (reads session from prop/context if needed; in Unit 1, manager email may be passed via page-level `getServerSideProps`)

**Renders**:
- Top navigation bar containing:
  - App name/logo ("1:1OS")
  - Manager email (displayed as text, right-aligned)
  - Logout button
- `<main>` wrapper for `children`

**Logout interaction**:
1. User clicks "Log out"
2. `POST /api/auth/logout` called
3. On success: redirect to `/auth/login`

**API Integration**:
- `POST /api/auth/logout` → clears `session` cookie → redirect

---

### 9. withAuth HOC (`lib/withAuth.ts`)

**Purpose**: Higher-Order Component (HOC) that wraps authenticated pages. Redirects unauthenticated users to `/auth/login` via server-side redirect.

**Signature**:
```typescript
function withAuth<P extends object>(
  Page: NextPage<P>,
  options?: { redirectTo?: string }
): NextPage<P>
```

**Behavior** (server-side via `getServerSideProps`):
1. Extract `session` cookie from incoming request
2. Verify JWT signature using `SECRET_KEY`
3. Check JWT expiry (`exp` claim)
4. If valid: extract `managerId`, pass as prop to page
5. If invalid or missing: return `{ redirect: { destination: '/auth/login', permanent: false } }`

**Props injected into wrapped page**:
| Prop        | Type   | Description                        |
|-------------|--------|------------------------------------|
| `managerId` | string | Authenticated manager's ID         |

**Usage**:
```typescript
export default withAuth(DashboardPage)
```

**Note**: All protected pages export their component wrapped with `withAuth`. The HOC composes with any existing `getServerSideProps` on the page by merging results.

---

## User Interaction Flows

### Flow A: Registration

```
User lands on /auth/register
  → Fills email + password (min 8 chars shown as hint)
  → Submits form
  → POST /api/auth/register
    → Success: cookie set → redirect /dashboard
    → Error 409 (email exists): "An account with this email already exists."
    → Error 400 (validation): "Password must be at least 8 characters."
```

### Flow B: Login

```
User lands on /auth/login
  → Fills email + password
  → Submits form
  → POST /api/auth/login
    → Success: cookie set → redirect /dashboard
    → Error 401: "Incorrect email or password."
```

### Flow C: Forgot Password

```
User lands on /auth/forgot-password
  → Enters email
  → Submits
  → POST /api/auth/forgot-password
    → Always shows: "If an account exists for this email, a reset link has been sent."
  → User clicks link in email → /auth/reset-password?token=<rawToken>
```

### Flow D: Reset Password

```
User lands on /auth/reset-password?token=<rawToken>
  → Page extracts token from URL
  → User enters new password (min 8 chars)
  → POST /api/auth/reset-password
    → Success: "Password updated. Please log in." + link to /auth/login
    → Error (expired): "This link has expired. Please request a new one."
    → Error (used): "This link is no longer valid."
```

### Flow E: Session Expiry

```
User makes request to protected page
  → withAuth detects expired/missing JWT
  → Server-side redirect to /auth/login
  → (client sees login page with no error — expiry message is handled server-side only)
```

### Flow F: Logout

```
User clicks "Log out" in AppLayout
  → POST /api/auth/logout
  → Cookie cleared
  → Redirect to /auth/login
```

---

## Form Validation Summary

| Page                   | Field    | Client Validation                | Server Validation              |
|------------------------|----------|----------------------------------|--------------------------------|
| RegisterPage           | email    | Non-empty + RFC 5322 format      | Non-empty + uniqueness         |
| RegisterPage           | password | Min 8 characters                 | Min 8 characters               |
| LoginPage              | email    | Non-empty                        | Lookup + bcrypt compare        |
| LoginPage              | password | Non-empty                        | bcrypt compare                 |
| ForgotPasswordPage     | email    | Non-empty                        | (always returns success)       |
| ResetPasswordPage      | password | Min 8 characters                 | Min 8 + token validation       |

---

## API Endpoints Consumed by Unit 1 Frontend

| Method | Endpoint                     | Consumer Component         | Auth Required |
|--------|------------------------------|----------------------------|---------------|
| POST   | `/api/auth/register`         | RegisterPage               | No            |
| POST   | `/api/auth/login`            | LoginPage                  | No            |
| POST   | `/api/auth/logout`           | AppLayout                  | Yes (cookie)  |
| POST   | `/api/auth/forgot-password`  | ForgotPasswordPage         | No            |
| POST   | `/api/auth/reset-password`   | ResetPasswordPage          | No (token in body) |

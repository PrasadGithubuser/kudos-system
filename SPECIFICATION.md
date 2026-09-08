# Kudos System Specification

**Repository:** https://github.com/PrasadGithubuser/kudos-system

*Status: Approved. This is the final specification used to generate the implementation in this repository.*

## Background

Initial request: "We need a way for people to give kudos to each other."

This was expanded into a formal specification via an AI-assisted, spec-driven
process. The initial AI-generated draft covered the core give/view flow but
did not consider content moderation — this was identified during architect
review and added below (see **Step 2 additions**, marked ✏️).

## Functional Requirements

### User Stories

1. As a user, I can see a list of my colleagues.
2. As a user, I can select a colleague and write a short appreciation message.
3. As a user, I can submit the kudos, which is saved and timestamped.
4. As a user, I can view a public feed of the most recent kudos on the dashboard.
5. ✏️ As an administrator, I can hide or delete inappropriate kudos messages so they no longer appear in the public feed.

### Acceptance Criteria

- Kudos message must be non-empty and 500 characters or fewer.
- A user cannot submit a kudos without selecting a recipient.
- A user cannot send a kudos to themselves.
- The public feed shows the most recent kudos first (newest at the top).
- The feed shows sender name, recipient name, message, and a relative timestamp.
- ✏️ The public feed only shows kudos where `is_visible = true`; hidden kudos never appear to regular users.
- ✏️ An admin can view ALL kudos, including hidden ones, in a dedicated admin view.
- ✏️ An admin can hide a kudos (soft-delete: sets `is_visible = false`, record is kept) or permanently delete it.
- ✏️ When an admin hides a kudos, the system records who did it, when, and an optional reason.
- ✏️ An admin can also restore (unhide) a kudos they previously hid.
- ✏️ **Edge cases considered:**
  - *Self-kudos*: rejected at submission time (validation error).
  - *Empty/oversized messages*: rejected at submission time.
  - *Spam/inappropriate content*: not auto-filtered — handled via the admin moderation flow rather than automated content scanning, which was judged out of scope for this iteration.
  - *Duplicate submissions*: not auto-blocked, since two genuine kudos with similar wording are a legitimate scenario; left to admin discretion via the moderation view rather than a hard rule that could reject valid appreciation.

## Technical Design

### Database Schema

**users**

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| email | TEXT | unique |
| ✏️ is_admin | BOOLEAN | default false |

**kudos**

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| sender_id | INTEGER FK → users.id | |
| recipient_id | INTEGER FK → users.id | |
| message | TEXT | max 500 chars, enforced at the API layer |
| created_at | DATETIME | default now |
| ✏️ is_visible | BOOLEAN | default true; false = hidden from public feed |
| ✏️ moderated_by | INTEGER FK → users.id, nullable | which admin took action |
| ✏️ moderated_at | DATETIME, nullable | when moderation happened |
| ✏️ reason_for_moderation | TEXT, nullable | optional reason recorded by the admin |

### API Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/users` | Any | List users, for the recipient dropdown |
| POST | `/api/kudos` | Any (identified via `x-user-id`) | Submit a new kudos |
| GET | `/api/kudos` | Any | Public feed — visible kudos only, newest first |
| ✏️ GET | `/api/admin/kudos` | Admin only | All kudos, including hidden |
| ✏️ PATCH | `/api/admin/kudos/:id/hide` | Admin only | Soft-delete a kudos, with a recorded reason |
| ✏️ PATCH | `/api/admin/kudos/:id/unhide` | Admin only | Restore a hidden kudos |
| ✏️ DELETE | `/api/admin/kudos/:id` | Admin only | Permanently delete a kudos |

### Frontend Components

- `KudosForm` — colleague dropdown + message textarea (with live character count) + submit button.
- `KudosFeed` — list of recent visible kudos, refreshable.
- `Dashboard` — combines `KudosForm` + `KudosFeed`; also hosts the identity switcher.
- ✏️ `AdminPanel` — visible only to the currently-selected admin user; lists every kudos (visible and hidden) with hide/unhide/delete actions and shows the moderation reason where one was given.

### Security Considerations

- ✏️ **All `/api/admin/*` endpoints re-verify `is_admin` server-side against the database on every request** — the server never trusts a client-supplied admin flag. The frontend only *hides* the admin UI for non-admins as a convenience; the real enforcement is server-side and independently testable (confirmed: a non-admin user calling an admin endpoint directly receives `403 Forbidden`).
- Identity is passed via an `x-user-id` header. A full authentication system (passwords/sessions/SSO) was scoped out of this exercise; this header simulates "who is logged in" so the permission model can be implemented and tested. In a production deployment, this header would be replaced by a verified session/JWT rather than a client-chosen value.
- User input (kudos messages) is escaped before rendering in the browser to prevent stored XSS.

### Performance Considerations

- The public feed query is limited to the 50 most recent visible kudos rather than returning the entire table.
- SQLite (via `better-sqlite3`) is synchronous and file-based, which is appropriate for this internal tool's expected scale; a higher-traffic deployment would move to a server-based database (e.g. Postgres) without changing the schema above.

### Error Handling

- All validation errors (missing recipient, empty/oversized message, self-kudos) return `400` with a plain-language `error` message that the frontend displays inline.
- Missing/invalid identity returns `401`; a valid but non-admin identity calling an admin route returns `403`.
- Unknown kudos IDs on admin actions return `404`.

## Implementation Plan

1. Set up project structure (Express backend, SQLite via `better-sqlite3`, static frontend, no build step).
2. Create the DB schema, including the moderation fields, and seed sample users (including one admin) and sample kudos.
3. Build `GET /api/users` and `POST /api/kudos`, with validation.
4. Build `GET /api/kudos` (visible-only, most-recent-first).
5. ✏️ Build the admin endpoints (`GET /api/admin/kudos`, `PATCH .../hide`, `PATCH .../unhide`, `DELETE ...`) behind server-side admin-check middleware.
6. Build the `KudosForm` + `KudosFeed` frontend.
7. ✏️ Build the `AdminPanel` frontend, shown only when the active user is an admin.
8. Wire frontend to API; add the "Acting as" identity switcher.
9. Manual testing pass: verified a non-admin gets `403` from admin routes, verified hiding a kudos removes it from the public feed, verified self-kudos and oversized messages are rejected.

## Testing Strategy

- Manual end-to-end verification of each endpoint via HTTP requests (submission validation, feed visibility filtering, admin permission enforcement, hide/unhide/delete flows) — see commit history / DEBUG notes.
- Recommended next step for production-readiness: automated `unittest`/`jest`-style tests covering the same scenarios, following the same test-first approach used in Task 1.

## Deployment Considerations

- `kudos.db` is excluded from version control (`.gitignore`) since it's generated data, not source code — a fresh instance seeds itself automatically on first run.
- Environment variable `PORT` can override the default port (3000) for deployment behind a reverse proxy.

## Reflection

**How did the structured approach to specification change your development process compared to traditional coding?**

Normally the request would have gone straight to code — that's the "vibe coding" this exercise contrasts with. Instead, the AI produced a draft spec first (user stories, database schema, API endpoints) before any code existed. That surfaced a real gap — no content moderation at all — while it was still just a table in a document, not code that would need to be restructured later. Catching it at the spec stage meant the database schema, API routes, and frontend admin panel were all designed together and consistently, instead of moderation being bolted on afterward.

**What was the most challenging part of reviewing and refining the AI-generated specification?**

Thinking through moderation's actual mechanics rather than just adding the headline requirement. It's easy to write "admins can delete bad kudos," but the harder part was the follow-on questions: should deleting be permanent or reversible? Who's accountable for a moderation action, and should that be recorded? What happens to duplicate or borderline-spam kudos — auto-block them, or leave it to human judgment? That's why the schema ended up with `is_visible`, `moderated_by`, `moderated_at`, and `reason_for_moderation` instead of just a delete button, and why the spec explicitly treats duplicates as a case for admin review rather than an automatic rejection.

**How did having a complete specification before implementation affect the quality and completeness of the final code?**

The implementation had no rework loop — every piece (schema fields, the three admin API endpoints, the server-side permission check, the admin UI panel) was built once, directly from what the spec already called for, because the spec had already settled the hard questions. It also meant the security requirement — that the server independently re-checks admin status rather than trusting the frontend — was designed in from the start and could be directly tested (a non-admin hitting an admin endpoint returns `403`), rather than discovered as a gap after the fact.
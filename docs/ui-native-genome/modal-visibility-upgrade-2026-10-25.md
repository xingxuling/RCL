# RCL Native UI v0.6 — Conditional Visibility & Governed Modal

Status: **research preview / bounded candidate**. Source baseline: `xingxuling/RCL` main after PR #267.

## Goal and ownership

Product: make dialog confirmation usable in RCL apps without requiring external JavaScript to govern modal authority.
UX: simple `view ConfirmDialog { property modal = true; accessibility_label "..."; bind visible <- state }` nested under an overlay root.
Engineering: one sealed semantic UI IR projected to Web and Android; canonical visibility and modal gates cannot be bypassed through direct `dispatch`.
Security: invalid, hidden or background events must not mutate state, history or Reality authority.

## Bounded v0.6 syntax

- All four UI roles may declare `property visible = true|false` or `bind visible <- Truth`.
- `property modal = true` applies to exactly one direct child `view` of a root whose `layout` is `overlay`.
- Modal requires `accessibility_label` and bound visible state; nested dialogs and multi-modal stacking are intentionally rejected.
- Modal events can close/open via UI-local state; no implicit Reality transaction permission is granted.

## Mappings

- **Canonical runtime:** rejects events on an invisible node or within an invisible ancestor (`RCL_UI_EVENT_HIDDEN`), and all events outside a visible modal (`RCL_UI_MODAL_BLOCKED`), before trace/state mutation.
- **Web:** `role=dialog`, `aria-modal=true`, dynamic hidden, background `inert`/`aria-hidden`, modal-layer CSS and guarded event dispatcher. Browser focus lands in the dialog when it appears; background focus is made inert. No automatic Escape-to-close protocol in v0.6.
- **Android:** `FrameLayout` overlay and `LinearLayout` dialog, `View.VISIBLE/GONE` projection, screen overlay dim background, declarative focusability, and per-event canonical-equivalent authority gate. No Android `DialogFragment`, lifecycle-window restoration or IME/focus trap claim.

## Evidence

- Added `tests/native-ui-modal-visibility.test.mjs`, covering source/IR verification, forged IR rejection, denial of background/hidden events, successful open-close, Web JavaScript generation/parsing and Android Java source generation.
- Native UI full test suite run in the sandbox; two pre-existing event runtime tests require unavailable Windows compiler host (`RCL_WINDOWS_COMPILER_HOST_REQUIRED`).
- Chromium headless attempted but timed out; **real browser interaction not certified**. Android Java generated; **APK compilation/installation not certified**.

## Deliberate exclusions and follow-up

- No arbitrary runtime list data / `Sequence`-backed `repeat` AST; existing scalar UI state types remain unchanged.
- No generalized reusable component declaration/instantiation nor multi-dialog stack.
- Follow-up: typed state sequences with stable child keys; then reusable UI components and scoped stores.

Rollback: revert the v0.6 commit/PR. No schema migration; remove `visible` and `modal` source usage when reverting.

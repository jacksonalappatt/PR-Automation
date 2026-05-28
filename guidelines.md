# PR Review Guidelines

As an automated PR reviewer, please analyze the code changes against the following guidelines. Provide constructive, clear, and action-oriented feedback.

# Code Review Guidelines

This document defines what reviewers must check when reviewing pull requests. Every item maps back to an enforced coding standard, architecture rule, or quality expectation.

---

## Review Priority Levels

| Priority | Label        | Meaning                                                                 |
| -------- | ------------ | ----------------------------------------------------------------------- |
| P0       | **Blocker**  | Must fix before merge — security flaw, data loss risk, broken build     |
| P1       | **Critical** | Must fix — violates enforced lint/convention rule, causes runtime error |
| P2       | **Major**    | Should fix — architectural mismatch, performance concern, missing tests |
| P3       | **Minor**    | Nice to fix — naming, formatting, documentation improvement             |
| P4       | **Nit**      | Optional suggestion — style preference, alternative approach            |

---

## 1. Angular API Usage (P1)

| ❌ Reject if you see                 | ✅ Expected pattern                                               |
| ------------------------------------ | ----------------------------------------------------------------- |
| `inject()` function                  | Constructor DI with `private readonly`                            |
| `@Input()` / `@Output()` decorators  | Signal-based `input()` / `output()`                               |
| `standalone: true` explicitly set    | Omit — standalone by default                                      |
| `@HostBinding` / `@HostListener`     | `host` property in component metadata                             |
| `ActivatedRoute.params` subscription | Signal `input()` with `effect()` (router `bindToComponentInputs`) |
| `*ngIf`, `*ngFor`, `*ngSwitch`       | New control flow: `@if`, `@for`, `@switch`                        |
| `ngClass` / `ngStyle`                | Direct `[class.name]` / `[style.prop]` bindings                   |
| Function calls in templates          | `computed()` signals or pipes                                     |
| Getters accessed in templates        | Imperatively-updated properties or `computed()` signals           |
| `$any()` in templates                | Fix the type properly                                             |
| `<button>` without `type` attribute  | Always specify `type="button"`, `"submit"`, or `"reset"`          |

---

## 2. TypeScript Quality (P1)

| Check                                | Rule                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------ |
| No `any` type                        | Use `unknown` + type guards when type is truly unknown                                                                          |
| No `!` non-null assertion            | Narrow the type with a guard                                                                                                    |
| `??` for null/undefined fallbacks    | Never `                                                                                                                         |     | ` for this purpose |
| `?.` for optional chaining           | Never `&&` null-guard chains                                                                                                    |
| `===` / `!==` strict equality        | Never `==` / `!=`                                                                                                               |
| Throw only `Error` objects           | Never throw strings or literals                                                                                                 |
| All Promises handled                 | Must be `await`ed or `.catch()`-ed                                                                                              |
| No async void event handlers         | Wrap or handle correctly                                                                                                        |
| No nested subscriptions              | Chain RxJS operators (`switchMap`, `combineLatest`)                                                                             |
| No `console.log`                     | Only `console.warn` or `console.error`                                                                                          |
| No parameter mutation                | Clone/spread before modifying                                                                                                   |
| No `else` after return               | Use early returns / guard clauses                                                                                               |
| `prefer-const` over `let`            | Use `let` only when re-assignment is needed                                                                                     |
| Template literals over concatenation | Use backtick strings for interpolation                                                                                          |
| No chained array iterations          | Replace `.map()` → `.some()` → `.reduce()` with single `for...of` loop                                                          |
| Descriptive variable names           | No single-letter or cryptic abbreviations (`v`, `rc`, `col`, `yt`) — use `bandValue`, `roadClass`, `bandColumn`, `yearlyTarget` |
| No magic strings in comparisons      | Use enums for type checks/discriminators — never `=== 'current'`, always `=== RowType.CURRENT`                                  |

---

## 3. Security (P0)

Reject immediately if any of these appear:

- [ ] `innerHTML` assignment or `[innerHTML]` binding without sanitisation
- [ ] `document.write`
- [ ] `eval()`, `new Function()`, or `setTimeout`/`setInterval` with string argument
- [ ] Committed secrets, API keys, license keys, or environment-specific values
- [ ] Hardcoded URLs pointing to production/staging environments

---

## 4. Component Architecture (P2)

### Smart vs Presentational

- **Presentational** components: signal inputs/outputs only, `ChangeDetectionStrategy.OnPush`, no service injection, no business logic.
- **Smart** components: inject services, manage state, compose presentational children.

### Reviewer Checklist

- [ ] Is `ChangeDetectionStrategy.OnPush` used where appropriate (input-only components)?
- [ ] Are signals (`signal()`, `computed()`) used **only when necessary** — i.e., when plain variables with new control flow (`@if`, `@for`) cannot achieve the same result? Do not overuse signals for state that can be a simple property.
- [ ] Is component class order followed? (inputs → outputs → fields → constructor → lifecycle → public methods → private methods)
- [ ] Is the component under ~200 lines? If longer, can logic be extracted to services or child components?
- [ ] Is `@UntilDestroy()` decorator present on components with subscriptions?
- [ ] Are subscriptions using `.pipe(untilDestroyed(this))`?

---

## 5. Component LLD Documentation (P2)

Every component **must** include a JSDoc LLD block above the class:

- [ ] Starts with one-line component title and dashes separator
- [ ] Contains overview paragraph explaining purpose and context
- [ ] Organises each user flow as a numbered section (Add Flow, Edit Flow, View Flow, Delete Flow)
- [ ] Uses formal language: "System shall…", "User shall…", "On [event] system shall…"
- [ ] Documents API calls with HTTP method and endpoint
- [ ] Documents field validations (mandatory, max length, data type)
- [ ] Documents navigation paths, cancel behavior, and unsaved changes logic

---

## 6. JSDoc on Members (P1)

ESLint enforces `jsdoc/require-jsdoc`. Verify:

- [ ] Every **public** method, getter, setter, and arrow function property has a JSDoc block
- [ ] Every **private** method has a JSDoc block (documents intent for maintainers)
- [ ] `@param` tags are present for all parameters with meaningful descriptions
- [ ] `@returns` tag is present for non-void methods
- [ ] No redundant type annotations in JSDoc (TypeScript carries the type)
- [ ] Constructors and lifecycle hooks (`ngOnInit`, `ngOnDestroy`) do NOT need JSDoc

---

## 7. Naming Conventions (P1)

| Element            | Convention                               | Example                          |
| ------------------ | ---------------------------------------- | -------------------------------- |
| Component selector | `iroads-` prefix, kebab-case             | `iroads-manage-analysis`         |
| Interface          | `I` prefix + PascalCase                  | `ISaveSdaRequest`                |
| Enum               | PascalCase                               | `InvestmentOptimiserStatus`      |
| Boolean variables  | `is/should/has/can/did/will/does` prefix | `isLoading`, `hasPermission`     |
| Methods            | camelCase, verb-first                    | `handleSearch()`, `loadData()`   |
| Event handlers     | `handle` prefix                          | `handleSort()`, `handleClick()`  |
| File names         | kebab-case with type suffix              | `manage-analysis.component.ts`   |
| Translation keys   | Dot-separated, SCREAMING_SNAKE_CASE      | `Page.Labels.SCENARIO_WORKSPACE` |

---

## 8. Import Ordering (P3)

Verify imports follow this sequence with blank lines between groups:

1. Angular core/common
2. Angular modules (router, forms, http)
3. Third-party libraries (NgRx, translate, Kendo, etc.)
4. RxJS
5. App-level configuration (`@configs/*`)
6. Shared libraries (`@iroads/*`)
7. Feature-local configs/constants
8. Feature-local models/interfaces
9. Feature-local services
10. Feature-local components

---

## 9. Template & Accessibility (P2)

- [ ] Prefer property binding (`[property]="value"`) wherever possible — avoid interpolation (`{{ }}`) for attribute values
- [ ] New control flow syntax used (`@if`, `@for`, `@switch`) — never structural directives
- [ ] Self-closing tags for components without content (`<iroads-icon />`)
- [ ] Every interactive element has a unique `id` attribute following `{screen}-{function}-{type}` convention
- [ ] Every `<button>` has an explicit `type` attribute
- [ ] Every `<img>` has a descriptive `alt` attribute
- [ ] Clickable elements have keyboard event handlers (`click-events-have-key-events`)
- [ ] Interactive elements are focusable (`interactive-supports-focus`)
- [ ] `<label>` elements are associated with their form controls
- [ ] No positive `tabindex` values
- [ ] ARIA roles include all required properties

---

## 10. Internationalisation (P1)

- [ ] No hardcoded display strings in templates or TypeScript
- [ ] Translation keys checked in base lib first (`libs/assets/i18n-base/`) before app files
- [ ] No duplicated keys between base lib and app files
- [ ] Both `en-GB.json` and `fr-FR.json` updated together
- [ ] Keys follow `Page.Labels.SOME_KEY` / `Page.Buttons.SOME_KEY` / `MESSAGE.SOME_KEY` structure
- [ ] Keys use SCREAMING_SNAKE_CASE and are descriptive within their block

---

## 11. Service Patterns (P2)

- [ ] Feature services use `@Injectable()` (NOT `providedIn: 'root'`) — provided at component level
- [ ] HTTP methods return typed `Observable<T>` — never `any`
- [ ] API endpoints use the `_config` params pattern for API type routing
- [ ] Service methods are marked `/*istanbul ignore next*/` if they are pure HTTP delegations
- [ ] Services use `private readonly http: HttpClient` constructor injection

---

## 12. Form Patterns (P2)

- [ ] Forms built using `FormBuilder` in a private `buildForm()` method
- [ ] Validators composed properly (not duplicated across fields)
- [ ] Conditional validation uses `ValidationService.conditional()`
- [ ] Form state drives button enable/disable logic (not standalone booleans)

---

## 13. State Management (P2)

- [ ] Cross-component state uses NgRx Store with selectors
- [ ] Store selectors are used for reading — no manual filtering of store state in components
- [ ] Actions dispatched for state mutations — no direct store state manipulation
- [ ] Local component state uses `signal()` / `computed()` where appropriate

---

## 14. Testing (P2)

- [ ] Tests exist for new/modified components, services, and pipes
- [ ] Test file co-located with source: `feature.component.spec.ts`
- [ ] Single `describe` block — no nested describes
- [ ] `setup()` factory function used for fixture creation
- [ ] Mock data factories with `Partial<T>` overrides
- [ ] Test titles follow `should [WHAT] when [WHEN] by [HOW]` format
- [ ] No function names, lifecycle hooks, or technical terms in test titles
- [ ] `CUSTOM_ELEMENTS_SCHEMA` and `NO_ERRORS_SCHEMA` used for isolation
- [ ] Tests do not rely on implementation details (test behaviour, not internals)
- [ ] Private members are never accessed directly in tests — invoke the public method that triggers the private member instead

---

## 15. Feature Folder Structure (P2)

When a new feature is introduced, verify the folder structure:

```
feature-name/
├── feature-name.routes.ts
├── configs/
├── models/
│   └── index.ts          ← barrel export required
├── services/
│   └── index.ts          ← barrel export required
├── pipes/
│   └── index.ts          ← barrel export required
├── components/
│   └── component-name/
│       ├── component-name.component.ts
│       ├── component-name.component.html
│       ├── component-name.component.scss
│       └── component-name.component.spec.ts
└── shared/
    └── components/
        └── index.ts      ← barrel export required
```

- [ ] Barrel `index.ts` files exist for models, services, pipes, and shared components
- [ ] Route configuration uses lazy loading with `loadComponent`
- [ ] No circular imports between feature modules

---

## 16. Routing (P2)

- [ ] Routes use `loadComponent` for lazy loading
- [ ] Route `data` includes `pageName` and `sideMenuItems`
- [ ] `canDeactivate` guard present on edit/create routes (unsaved changes protection)
- [ ] Route params read via signal `input()` + `effect()` — not `ActivatedRoute` subscription

---

## 17. Performance (P2)

- [ ] No function calls in templates — only `computed()` or pipes
- [ ] No getters accessed from templates — use imperatively-updated properties or `computed()` signals instead (getters re-execute on every change detection cycle)
- [ ] No chained array iteration methods (`.map()` → `.some()` → `.reduce()`) — consolidate into a single `for...of` loop with early exit
- [ ] No magic strings in comparisons — use enums for type discriminators instead of hardcoded string literals
- [ ] `trackBy` function (or `track` expression in `@for`) used for list rendering
- [ ] Heavy computations moved to services or `computed()` — not triggered every change detection cycle
- [ ] Large lists use virtual scrolling or pagination
- [ ] Subscriptions are properly cleaned up (`untilDestroyed`)

---

## 18. Formatting & Style (P4)

- [ ] Single quotes for strings
- [ ] 4-space indentation
- [ ] Semicolons at end of statements
- [ ] Line width ≤ 145 characters
- [ ] No trailing commas
- [ ] Bracket spacing: `{ key: value }`
- [ ] Object shorthand: `{ foo }` not `{ foo: foo }`

---

## 19. Theme Awareness (P2)

If the change involves visual/styling updates:

- [ ] UKLA design tokens scoped behind `.layout-rev` class or `systemTheme() === IroadsTheme.UKLA` check
- [ ] Default theme remains unaffected by UKLA-specific styles
- [ ] `docs/ukla-design-system.md` updated if new tokens or component styles are added/modified

---

## 20. PR Submission Checklist (P1)

Before approving, confirm the author has:

- [ ] Run `yarn lint && yarn stylelint && yarn type-check` with no errors
- [ ] Run `nx test <affected-project>` with all tests passing
- [ ] Linked the relevant work item / ticket
- [ ] Provided screenshots for UI changes
- [ ] Documented any schema, configuration, or migration impacts
- [ ] Kept the commit focused on one concern with a conventional commit message

---

## Reviewer Conduct

1. **Be specific** — point to the exact line and explain why it violates a standard (link to this doc or `coding-standards.md`).
2. **Label severity** — prefix comments with `[P0]`, `[P1]`, etc. so authors know what must be fixed vs. what is optional.
3. **Suggest, don't demand** for P3/P4 — use "Consider…" or "Nit:" prefix.
4. **Acknowledge good work** — call out clean patterns, thoughtful abstractions, or well-written tests.
5. **One round max for nits** — if P3/P4 items aren't addressed, approve anyway. Don't block merges on style.
6. **Check the diff, not the whole file** — focus on changed lines unless a structural issue is evident.
7. **Timebox reviews** — aim to complete within 1 hour of request. Unblock teammates quickly.

---

## Quick Reference: Common Review Comments

| Pattern Spotted                  | Standard Comment                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `inject()` used                  | `[P1] Use constructor DI with private readonly — see coding-standards.md §DI & Angular APIs`      |
| Missing JSDoc on public method   | `[P1] Add JSDoc block — ESLint jsdoc/require-jsdoc requires it for all public members`            |
| `*ngIf` in template              | `[P1] Use @if control flow — structural directives are banned in this project`                    |
| Hardcoded string in template     | `[P1] Extract to translation key — see coding-standards.md §i18n`                                 |
| Function call in template        | `[P1] Move to computed() signal or pipe — no-call-expression rule`                                |
| Getter accessed in template      | `[P2] Convert to imperatively-updated property — getters re-run on every CD cycle`                |
| Chained `.map().some().reduce()` | `[P2] Consolidate into single for...of loop — avoid multiple iterations over same data`           |
| Single-letter variable name      | `[P1] Use descriptive name — e.g. bandValue not v, roadClass not rc`                              |
| Magic string in comparison       | `[P1] Use enum instead of hardcoded string — e.g. RowType.CURRENT not 'current'`                  |
| Missing `id` on button           | `[P2] Add id following {screen}-{function}-btn convention — see coding-standards.md §Element IDs` |
| No test for new component        | `[P2] Add spec file with at least happy-path and error-path coverage`                             |
| Missing LLD documentation        | `[P2] Add component LLD JSDoc block above the class — see coding-standards.md §LLD`               |
| `console.log` left in            | `[P1] Remove console.log — only console.warn/error allowed`                                       |
| `any` type used                  | `[P1] Replace with proper type or unknown + type guard`                                           |
| Nested subscription              | `[P1] Flatten with switchMap/combineLatest — no nested subscriptions`                             |
| Missing barrel export            | `[P2] Add export to index.ts — all public symbols must be barrel-exported`                        |
| Import order wrong               | `[P3] Reorder imports — Angular → third-party → RxJS → @configs → @iroads → local`                |
| Missing `type` on `<button>`     | `[P1] Add type="button" — ESLint button-has-type requires it`                                     |

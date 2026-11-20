# Blue Handbook Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. User has approved the design; execute inline and keep the completed local feature branch.

**Goal:** Unify six handbook columns around the comparison workbench's visual language in blue.

**Architecture:** Add one screen-only embedded stylesheet scoped to non-comparison pages. Existing markup, runtime, data, comparison generation, font assets and print CSS remain intact. Browser checks validate the requested theme and style isolation against the actual rendered page.

**Tech Stack:** HTML, CSS, existing JavaScript, Python unittest, Python Playwright with installed Chrome.

## Global Constraints

- Branch: feat/blue-handbook-style; base: feat/dual-platform-agent at d40899b.
- Local only; do not merge main, push or publish.
- Apply the user-approved design in docs/superpowers/specs/2026-10-30-blue-handbook-design.md.
- No model requests or new runtime dependencies.
- Preserve all comparison source files and existing content/data.

### Task 1: Establish the browser acceptance check

**Files:** Create tests/test_blue_style_browser.py.

**Interfaces:** Consume --url for an existing preview and --screenshots for optional output; return nonzero if theme, layout, interaction, offline or print isolation checks fail.

- [x] Assert blue section titles and square primary content containers on all six pages at 1440 and 390px.
- [x] Assert no document overflow at 320, 390, 768 and 1440px, while allowing explicitly scrollable inner navigation.
- [x] Assert comparison selection still has the original red gradient and 13 dimensions.
- [x] Verify catalogue search, empty state, pagination, guide carousel, reading links and chapter history.
- [x] Run before production changes; confirm the existing rounded catalogue cards or red guide styling fail the requested appearance check.

### Task 2: Apply the scoped visual system

**Files:** Modify index.html outside COMPARISON_* generated sections.

**Interfaces:** Existing body[data-current-page] is the theme boundary; existing classes remain the component hooks. The new style is identified by handbook-blue-styles.

- [x] Add the approved palette and core component rules under @media screen:

```css
body:not([data-current-page="comparison"]) {
  --vermilion: #175fa8;
  --vermilion-soft: #e8f0f8;
  --paper: #ffffff;
  --mist: #f5f8fc;
  --line: #d3dfeb;
}
```

- [x] Scope square cards, blue selected states, white inputs, blue titles and fine borders to the six non-comparison columns; override the guide's old hard-coded reds inside the same scope.
- [x] Preserve page-specific layout; use a navy gradient cover and white reading surfaces, remove legacy circular decorative treatments on the revised cover.
- [x] Set mobile wrapping, flexible field grids, restrained heading sizes and visible focus outlines; keep screen rules out of print.
- [x] Run browser acceptance, inspect desktop and mobile screenshots, and resolve any observed overflow or contrast failures.

### Task 3: Verify and preserve the local result

**Files:** Update README.md, CHANGELOG.md and docs/verification.md with scope and actual results.

- [x] Run python3 -m unittest discover -s tests -v; expect all 41 existing tests to pass.
- [x] Run node tests/test_navigation.cjs and node tests/test_comparison.cjs; expect 8 plus 44 assertions to pass.
- [x] Run python3 scripts/build_comparison.py --check and git diff --check; expect zero errors.
- [x] Verify comparison generated blocks and source/data files are unchanged from d40899b.
- [x] Review the diff and browser evidence; correct important findings before finalizing.
- [x] Commit the local feature branch, confirm main and feat/dual-platform-agent retain their original commit IDs, and report branch, checkout and preview artifacts.

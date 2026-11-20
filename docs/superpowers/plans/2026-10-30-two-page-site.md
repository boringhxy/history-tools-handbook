# Two-page Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute inline against the user-approved two-column scope, preserve the local feature branch.

**Goal:** Keep the catalogue and comparison workbench, archiving all other content as Markdown.

**Architecture:** Export rendered content before removal. Keep canonical catalogue and comparison JSON as build inputs, inline them for offline reading, and replace seven-column presentation/runtime with a two-column shell. Preserve comparison engines and backend.

**Tech Stack:** HTML/CSS/JavaScript, Python, local uvx MarkItDown, Playwright and Chrome.

## Global Constraints

- Local branch feat/catalog-compare-only; base a5d4424; do not modify main or the prior feature branches.
- Archive before removal, with headings/lists/tables/source links and original evidence caveats.
- Keep119 catalogue records and122 comparison records unchanged.
- Keep catalogue blue and current comparison styling; no model requests or publishing.

### Task 1: Establish preservation and simplification checks

- [x] Add tests/test_two_page_site.py asserting exactly two navigation/page entries and no removed page/runtime blocks.
- [x] Assert seven archived documents and index exist, with27 profile anchors,12 topic rows,8 guide stages,7 workflows and7 material records represented.
- [x] Run the structural test before implementation and observe the seven-page baseline fail.

### Task 2: Archive original material

- [x] Use a temporary localhost preview with model configuration disabled.
- [x] Export seven complete rendered content snapshots, including hidden reference panels and all collapsed details.
- [x] Run uvx markitdown for each snapshot; restore explicit anchors and rewrite internal links to archived documents or the two retained pages.
- [x] Compare normalised source text and source links against Markdown output; check complete profile/material/workflow counts.
- [x] Write docs/reference/README.md with migration date, source commit and document index.

### Task 3: Remove obsolete website code and rebuild

- [x] Add data/catalog.json from the exact existing tool-catalog-data value.
- [x] Replace index.html's old sections/styles/runtime with a compact two-page shell; keep comparison integration blocks and render the same catalogue record fields.
- [x] Set empty/invalid routes to #catalog; retain #compare and current comparison deep links.
- [x] Simplify scripts/build_comparison.py to load canonical JSON; remove scripts/build_comparison_data.py and obsolete migration dependencies.
- [x] Update tests/test_handbook.py, test_comparison_data.py and browser acceptance to validate the retained site/data and archived content.

### Task 4: Verify and deliver locally

- [x] Run all applicable Python and JavaScript tests, deterministic build check and git diff --check.
- [x] Validate 320/390/768/1440px, catalogue ten pages and filters, compare selection/copy/share/tabs, unavailable-service hints, offline and both print modes.
- [x] Review archive completeness and runtime removal; fix important issues. External review was requested but unavailable; completed a separate self-review with saved pre-removal snapshots and canonical data checks.
- [x] Update README/CHANGELOG/verification docs to the final two-page architecture.
- [x] Record size reduction, compare data hashes, preserved branch refs; commit only the local feature branch.

Completed locally on 2026-10-31. Final evidence is recorded in docs/verification.md; no merge, push or publication.

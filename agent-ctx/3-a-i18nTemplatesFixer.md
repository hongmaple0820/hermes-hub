# Task 3-a: Fix Duplicate `templates` Keys in Locale JSON Files

## Problem
Dashboard's "Conversation Templates" section showed raw i18n keys like `templates.codeReview` instead of translated text because locale JSON files had DUPLICATE `templates` keys — the second object overwrote the first one containing the template-specific keys.

## Root Cause
- en.json and zh.json both had two `templates` sections at lines 1694 and 1787
- First section: codeReview, researchAssistant, dataAnalysis, creativeWriting, translation, debugHelper and their Desc variants
- Second section: title, subtitle, name, description, icon, systemPrompt, etc.
- JSON specification: duplicate keys → last one wins → first section's keys lost at runtime

## Actions Taken

### en.json & zh.json
1. Removed the first `templates` section (lines 1694-1713)
2. Replaced the second `templates` section with a merged version containing ALL 31 keys from both

### ja.json, ko.json, de.json, es.json, fr.json, pt.json
1. These 6 locales had NO `templates` section at all
2. Added complete `templates` section with native translations for all 31 keys

## Verification
- All 8 locale JSON files validated (syntax OK)
- Exactly 1 `templates` section per file (no duplicates)
- All 8 files have identical 31 `templates` keys
- `bun run lint` passes clean (0 errors)

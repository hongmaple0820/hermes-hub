# Task 4-b: LLM Provider Quick Setup

## Agent: ProviderSetupEnhancer

## Work Done

### 1. i18n Keys Added
- **en.json**: Added `dashboard.noProviderTitle`, `dashboard.noProviderDesc`, `dashboard.setUpProvider`, `dashboard.learnMore`, `providers.quickAdd`, `providers.quickAddDesc`
- **zh.json**: Added corresponding Chinese translations for all 6 keys

### 2. Dashboard Provider Setup Card
- Added prominent setup card in `Dashboard.tsx` that appears when `activeProviders.length === 0`
- Features:
  - AlertTriangle warning icon in amber-toned container
  - Title and description using i18n keys
  - "Set Up Provider" button navigating to providers view with arrow icon
  - "Learn More" disabled button (placeholder for future)
  - Warm gradient background (amber/orange tones)
  - Animated border glow (`borderGlow` keyframe animation)
  - Shimmer accent line at top
  - Decorative blur circles
  - Motion animation on mount (fade-in, slide-up, scale)
  - Responsive layout (flex-col on mobile, flex-row on sm+)

### 3. ProviderManager Empty State Enhancement
- Added Quick Add section below the existing empty state
- Shows 4 popular provider buttons: OpenAI, Anthropic, Google, Ollama
- Each button pre-fills the create form with:
  - Provider type
  - Default base URL
  - Default model
  - Provider name (from i18n label)
- Opens the create dialog automatically when clicked
- Added Zap icon import from lucide-react
- Styled with hover effects (scale, shadow, border color change)

### 4. Verification
- Lint passes clean (`bun run lint`)
- No compilation errors in dev server log

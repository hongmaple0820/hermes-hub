Task ID: 6-b
Agent: WelcomeOnboardingBuilder
Task: Implement Welcome Onboarding Flow and Empty States

Work Log:
- Added i18n keys under `onboarding` namespace to en.json and zh.json (20 keys each): welcome, welcomeDesc, step1Title, step1Desc, step2Title, step2Desc, step3Title, step3Desc, step4Title, step4Desc, getStarted, next, back, skip, finish, createAgent, addProvider, browseSkills, builtinMode, builtinModeDesc, acrpMode, acrpModeDesc
- Added i18n keys under `emptyState` namespace to en.json and zh.json (12 keys each): noAgents, noAgentsDesc, createFirstAgent, noProviders, noProvidersDesc, addFirstProvider, noConversations, noConversationsDesc, startConversation, noAcrpAgents, noAcrpAgentsDesc, connectAgent
- Created `/home/z/my-project/src/components/shared/WelcomeOnboarding.tsx` — Multi-step onboarding modal with:
  - 4 steps: Welcome, Create Your First Agent, Add LLM Provider, Explore Skills
  - Step indicator with clickable dots and connecting lines
  - Skip button on each step, Back/Next navigation
  - Smooth framer-motion slide transitions between steps
  - Step-specific content: Builtin vs ACRP mode cards, provider badges, skill badges
  - CTA buttons on steps 2-4 that navigate to the appropriate section after finishing onboarding
  - Completion state stored in localStorage ('hermes_onboarding_completed')
  - `isOnboardingCompleted()` utility function exported for first-run detection
  - Dark mode support, responsive design
- Created `/home/z/my-project/src/components/shared/EmptyState.tsx` — Reusable empty state component with:
  - Icon with subtle floating animation (framer-motion)
  - Title and description with staggered fade-in
  - Optional primary action button
  - Optional secondary action button/link
  - Subtle decorative blurred background elements
  - Fade-in animations for each element
- Updated `/home/z/my-project/src/app/page.tsx` — First-run detection:
  - Added `showOnboarding` state
  - After login/register, checks `isOnboardingCompleted()` 
  - Shows WelcomeOnboarding dialog for first-time users
  - After registration, always shows onboarding
  - After login, shows onboarding only if not previously completed
  - Added WelcomeOnboarding component to render tree
- Updated `/home/z/my-project/src/components/views/AgentManager.tsx` — Replaced empty state:
  - Imported EmptyState component
  - Replaced inline Card+CardContent empty state with EmptyState using Bot icon
  - Uses emptyState.noAgents/noAgentsDesc/createFirstAgent i18n keys
- Updated `/home/z/my-project/src/components/views/ProviderManager.tsx` — Replaced empty state:
  - Imported EmptyState component
  - Replaced inline Card+CardContent empty state with EmptyState using Server icon
  - Uses emptyState.noProviders/noProvidersDesc/addFirstProvider i18n keys
- Updated `/home/z/my-project/src/components/views/ChatView.tsx` — Replaced empty states:
  - Imported EmptyState component
  - Replaced EmptyChatState's icon/title/description section with EmptyState component
  - Updated sidebar "no conversations" text to use emptyState.noConversations key
- Updated `/home/z/my-project/src/components/views/AgentControlCenter.tsx` — Replaced empty state:
  - Imported EmptyState component and Plus icon
  - Replaced inline Card+CardContent empty state with EmptyState using Monitor icon
  - Uses emptyState.noAcrpAgents/noAcrpAgentsDesc/connectAgent i18n keys
  - Added secondary action for "Generate Token" when agents exist
- Fixed lint errors: reordered useCallback declarations to avoid forward reference, added missing step dependency
- All lint checks pass clean
- Dev server compiles successfully

Stage Summary:
- **Welcome Onboarding Flow** fully implemented with 4-step modal dialog
- **EmptyState reusable component** created with animations and decorative backgrounds
- **First-run detection** integrated into page.tsx (localStorage-based)
- **4 existing views updated** to use EmptyState: AgentManager, ProviderManager, ChatView, AgentControlCenter
- **i18n support** for onboarding (20 keys) and emptyState (12 keys) in en.json and zh.json
- All existing functionality preserved — only visual empty states enhanced

// Route principale post-login — URL : /feed
// Le groupe (feed) est strippé dans l'URL, donc /feed et pas /(feed)/feed.
// Ticket E2-03 — Sprint 1 Auth & Onboarding.

import { FeedScreen } from '@/features/feed/screens/FeedScreen';

export default function FeedRoute() {
  return <FeedScreen />;
}

// Route profil personnel — URL : /profile
// Le groupe (feed) est protégé par le guard de session (voir _layout.tsx).
// Ticket E3-01 — Sprint 2 Profil.

import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

export default function ProfileRoute() {
  return <ProfileScreen />;
}

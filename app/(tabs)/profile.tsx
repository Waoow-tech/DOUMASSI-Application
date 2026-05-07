// Route profil personnel — URL : /profile
// Le groupe (tabs) est strippé dans l'URL, donc /profile et pas /(tabs)/profile.
// Ticket E3-01 — Sprint 2 Profil.

import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

export default function ProfileRoute() {
  return <ProfileScreen />;
}

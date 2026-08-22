// Tab Bell — écran Notifications (E4-17).
// L'écran lui-même vit dans src/features/notifications/ (pattern projet :
// route fine + screen séparé).

import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';

export default function NotificationsRoute() {
  return <NotificationsScreen />;
}

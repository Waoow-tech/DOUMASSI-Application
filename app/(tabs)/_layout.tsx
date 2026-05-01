// Tabs layout — placeholder for the main app navigation.
// Will be expanded with proper tab bar in a future sprint.

import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}

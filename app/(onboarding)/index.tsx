// Onboarding entry point — redirects to the first step (complete-profile).
// Replaces the old placeholder per ticket E2-09.

import { Redirect } from 'expo-router';

export default function OnboardingIndex() {
  return <Redirect href="/(onboarding)/complete-profile" />;
}

import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { FollowRelationScreen } from '@/features/profile/screens/FollowRelationScreen';

export default function OtherFollowersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return null;

  return <FollowRelationScreen userId={id} initialTab="followers" />;
}

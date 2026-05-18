import React, { useEffect, useState } from 'react';
import { Spinner, YStack } from 'tamagui';

import { FollowRelationScreen } from '@/features/profile/screens/FollowRelationScreen';
import { supabase } from '@/lib/supabase';

export default function MyFollowingRoute() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  if (!userId) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="#FFFFFF" />
      </YStack>
    );
  }

  return <FollowRelationScreen userId={userId} initialTab="following" />;
}

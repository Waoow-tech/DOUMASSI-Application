// Client Supabase pour React Native.
// La config persiste la session via AsyncStorage et auto-refresh le token.
// Doc officielle : https://supabase.com/docs/guides/getting-started/quickstarts/with-expo-react-native

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Sur mobile, pas de redirect URL à parser
      detectSessionInUrl: true,
    },
  }
);

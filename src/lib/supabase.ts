import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';

let secureStoreAvailable: boolean | null = null;

async function canUseSecureStore() {
  if (secureStoreAvailable === null) {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  }

  return secureStoreAvailable;
}

const authStorage = {
  async getItem(key: string) {
    return (await canUseSecureStore()) ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    return (await canUseSecureStore())
      ? SecureStore.setItemAsync(key, value)
      : AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    return (await canUseSecureStore())
      ? SecureStore.deleteItemAsync(key)
      : AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Sur mobile, pas de redirect URL à parser
      detectSessionInUrl: true,
      detectSessionInUrl: false,
    },
  }
);

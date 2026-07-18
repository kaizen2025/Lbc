import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://znxijeqxfofzmiuamdzc.supabase.co";
// Clé publishable — publique par design (la sécurité vient de l'auth + du serveur API).
const key =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_jHwPgyudigw-hF3ZMxbD5A_17_LyIpu";

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

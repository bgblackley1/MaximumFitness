import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://pilcaoybbmzlaadjazxv.supabase.co';
const supabaseAnonKey = 'sb_publishable_HQBGu_2EdlGq2YKmnnY1pw_6-zd1NxC';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
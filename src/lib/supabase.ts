import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isConfigValid = supabaseUrl && 
                     supabaseAnonKey && 
                     isValidUrl(supabaseUrl) && 
                     !supabaseUrl.includes('your-project');

export const supabase = isConfigValid
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as any, {
      get() {
        throw new Error(
          'Supabase credentials are missing or invalid. Please add a valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables in the Settings menu.'
        );
      }
    });

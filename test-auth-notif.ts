import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const email = `test_notif_ai_${Date.now()}@example.com`;
  const password = 'password123';
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signUpError) {
    console.log("Sign up err:", signUpError);
    return;
  }
  
  console.log("Signed in:", signUpData.user?.id);
  
  const { data, error } = await supabase.from('notifications').select('*').limit(1);
  console.log("Notifications fetch:", { data, error });
}
run();

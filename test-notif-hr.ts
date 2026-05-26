import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: hrUsers, error } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'hr']);
  console.log("HR Users:", hrUsers, "Error:", error);
}
run();

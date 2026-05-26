import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

if(!url) {
  console.log("No url found");
  process.exit();
}

const supabase = createClient(url, key);

async function run() {
  console.log("Checking notifications...");
  const { data, error } = await supabase.from('notifications').select('id').limit(1);
  if (error) {
    console.log("Error:", error);
  } else {
    console.log("Success, data:", data);
  }
}
run();

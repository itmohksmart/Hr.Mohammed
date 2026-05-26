import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('employees').update({ status: 'inactive|2023-10-10' }).eq('email', 'test@test.com').select();
  console.log(error ? error.message : "success");
}
main();

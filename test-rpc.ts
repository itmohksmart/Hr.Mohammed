import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: authUserId, error: rpcError } = await supabase.rpc('get_user_id_by_email', { _email: 'dorgamaltabi@gmail.com' });
  console.log("authUserId:", authUserId, "rpcError:", rpcError);
}
run();

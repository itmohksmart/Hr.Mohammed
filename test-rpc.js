import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const rawConfig = fs.readFileSync(path.resolve('./src/lib/supabase.ts'), 'utf8');
const urlMatch = rawConfig.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = rawConfig.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.error("Could not parse supabase config");
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.rpc('get_user_id_by_email', { _email: 'mohammedaltai7227@gmail.com' });
  console.log('RPC result:', { data, error });
}
run();

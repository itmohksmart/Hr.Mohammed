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
  const { data, error } = await supabase.from('notifications').insert({
    user_id: 'a0b9b5a2-9759-4d94-96fe-cff00a29f864', // Dummy UUID
    title: 'test',
    message: 'test',
    type: 'test',
    is_read: false
  });
  console.log({ data, error });
}

run();

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables.
// Service-role keys bypass RLS and must never be exposed to the browser, so this
// server-only script reads the non-VITE variable. The legacy VITE_-prefixed name
// is accepted for one release as a fallback; remove it once every environment
// (local/dev/CI/Netlify) has migrated to SUPABASE_SERVICE_ROLE_KEY.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_KEY;

if (process.env.SUPABASE_SERVICE_ROLE_KEY == null && process.env.VITE_SUPABASE_SERVICE_KEY != null) {
  console.warn(
    '[deprecated] Using VITE_SUPABASE_SERVICE_KEY. Rename it to SUPABASE_SERVICE_ROLE_KEY ' +
      '(no VITE_ prefix) — service-role keys must never be exposed to the browser.',
  );
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadSounds() {
  const soundsDir = path.join(process.cwd(), 'public', 'assets', 'sounds');
  const soundFiles = fs.readdirSync(soundsDir).filter(file => file.endsWith('.wav'));

  console.log('Found sound files:', soundFiles);

  for (const file of soundFiles) {
    const filePath = path.join(soundsDir, file);
    const fileStream = fs.createReadStream(filePath);
    
    console.log(`Uploading ${file}...`);
    
    const { data, error } = await supabase.storage
      .from('sounds')
      .upload(file, fileStream, {
        contentType: 'audio/wav',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading ${file}:`, error);
    } else {
      console.log(`Successfully uploaded ${file}`);
    }
  }
}

uploadSounds().catch(console.error); 
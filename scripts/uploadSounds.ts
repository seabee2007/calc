import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
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
import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load chunks from data file
const docs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/chunks.json'), 'utf8')
);

// Generate embeddings for each chunk
const out = docs.map((d) => {
  const p = spawnSync('python3', ['embed.py'], {
    input: d.text,
    encoding: 'utf8',
  });
  return { text: d.text, embedding: JSON.parse(p.stdout || '[]') };
});

// Save embeddings to file
fs.writeFileSync(
  path.join(__dirname, '../data/embeddings.json'),
  JSON.stringify(out, null, 2)
);
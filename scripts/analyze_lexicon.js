#!/usr/bin/env node

const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching Lexicon entries...\n');

  const response = await fetch('https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/trinity?category=lexicon');
  const entries = response.data;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LEXICON ENTRIES ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total entries: ${entries.length}\n`);

  // Find blank entries
  const blanks = entries.filter(e =>
    !e.title || e.title.trim() === '' ||
    !e.section_number || e.section_number.trim() === ''
  );

  console.log(`🔴 Blank entries: ${blanks.length}`);
  if (blanks.length > 0) {
    blanks.forEach(b => {
      console.log(`  ID ${b.id}: title="${b.title || '(EMPTY)'}" section="${b.section_number || '(EMPTY)'}"`);
    });
  }
  console.log('');

  // Show all section numbers with their order
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CURRENT SECTION NUMBERS (all entries):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  entries.forEach((e, i) => {
    const section = e.section_number || '(blank)';
    const title = (e.title || '(blank)').substring(0, 60);
    console.log(`${String(i + 1).padStart(3)}. ${section.padEnd(10)} - ${title}`);
  });

  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECOMMENDATION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Based on the analysis, we should:');
  console.log('1. Remove blank entries (if any)');
  console.log('2. Renumber all Lexicon entries sequentially as L01.01, L01.02, L01.03, etc.');
  console.log('3. Update all cross-references to match new section numbers\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

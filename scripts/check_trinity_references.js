#!/usr/bin/env node

/**
 * Trinity Reference Validator
 *
 * This script validates that all internal references in Trinity documentation
 * point to valid section numbers. It checks:
 * - RULE #X.Y references
 * - Section number references (e.g., "see §2.01")
 * - Links to Teacher and Lexicon chapters
 */

const https = require('https');

const API_BASE = 'https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/trinity';

// Fetch all Trinity entries
async function fetchAllEntries() {
  return new Promise((resolve, reject) => {
    https.get(API_BASE, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data) {
            resolve(json.data);
          } else {
            reject(new Error('Invalid API response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Extract all field values that might contain references
function extractContentFields(entry) {
  const fields = [];
  const contentFields = [
    'description', 'details', 'examples', 'recommendations',
    'summary', 'code_example', 'common_mistakes', 'testing_strategy',
    'scenario', 'root_cause', 'solution', 'prevention',
    'related_rules', 'dense_index'
  ];

  contentFields.forEach(field => {
    if (entry[field] && typeof entry[field] === 'string') {
      fields.push({ field, content: entry[field] });
    }
  });

  return fields;
}

// Find all RULE references (e.g., RULE #19.31, #19.31, B01.001, L01.002, T01.003)
function findRuleReferences(text) {
  const patterns = [
    /RULE\s*#(\d+)\.(\d+)/gi,       // RULE #19.31
    /#(\d+)\.(\d+)/g,                // #19.31
    /§(\d+)\.(\d+)/g,                // §19.31
    /([BLT])(\d{2})\.(\d{2,3})/g,   // B01.01 or B01.001 (2-digit or 3-digit)
    /Chapter\s+(\d+)/gi,             // Chapter 19
  ];

  const references = [];

  // Pattern 1-3: Standard numbered references
  [/RULE\s*#(\d+)\.(\d+)/gi, /#(\d+)\.(\d+)/g, /§(\d+)\.(\d+)/g].forEach(pattern => {
    let match;
    const regex = new RegExp(pattern);
    while ((match = regex.exec(text)) !== null) {
      references.push({
        type: 'rule',
        format: 'standard',
        chapter: parseInt(match[1]),
        section: match[2],
        text: match[0],
        position: match.index
      });
    }
  });

  // Pattern 4: Prefixed format (B01.01 or B01.001, L01.02 or L01.002, T01.03 or T01.003)
  const prefixPattern = /([BLT])(\d{2})\.(\d{2,3})/g;
  let match;
  while ((match = prefixPattern.exec(text)) !== null) {
    references.push({
      type: 'rule',
      format: 'prefixed',
      prefix: match[1],
      chapter: parseInt(match[2]),
      section: match[3],  // Keep as string to preserve padding (001 vs 1)
      text: match[0],
      position: match.index
    });
  }

  // Pattern 5: Chapter references
  const chapterPattern = /Chapter\s+(\d+)/gi;
  while ((match = chapterPattern.exec(text)) !== null) {
    references.push({
      type: 'chapter',
      chapter: parseInt(match[1]),
      text: match[0],
      position: match.index
    });
  }

  return references;
}

// Helper to get expected prefix for category
function getExpectedPrefix(category) {
  const prefixMap = { 'bible': 'B', 'lexicon': 'L', 'teacher': 'T' };
  return prefixMap[category] || '?';
}

// Helper to format section in prefixed style (3-digit format)
function formatPrefixedSection(category, chapterNum, sectionNum) {
  const prefix = getExpectedPrefix(category);
  const ch = String(chapterNum).padStart(2, '0');
  // Use 3-digit padding for section numbers
  const sec = String(sectionNum).padStart(3, '0');
  return `${prefix}${ch}.${sec}`;
}

// Validate references against actual entries
function validateReferences(entries) {
  // Build lookup maps for both formats
  const validSections = new Map();           // Standard format: "1.6"
  const validSectionsPrefixed = new Map();   // Prefixed format: "B01.06"
  const validChapters = new Set();
  const sectionFormatIssues = [];

  entries.forEach(entry => {
    // Store standard format
    validSections.set(entry.section_number, entry);
    validChapters.add(entry.chapter_number);

    // Check if section_number has correct prefix format
    const expectedFormat = formatPrefixedSection(
      entry.category,
      entry.chapter_number,
      entry.section_number.split('.')[1] || entry.section_number
    );

    // Store prefixed format for lookup
    validSectionsPrefixed.set(expectedFormat, entry);

    // Check if current format matches expected (accept both 2-digit and 3-digit)
    if (!entry.section_number.match(/^[BLT]\d{2}\.\d{2,3}$/)) {
      sectionFormatIssues.push({
        entry: {
          id: entry.id,
          category: entry.category,
          current: entry.section_number,
          expected: expectedFormat,
          title: entry.title
        }
      });
    }
  });

  // Check each entry's content for references
  const referenceIssues = [];

  entries.forEach(entry => {
    const contentFields = extractContentFields(entry);

    contentFields.forEach(({ field, content }) => {
      const references = findRuleReferences(content);

      references.forEach(ref => {
        if (ref.type === 'rule') {
          let isValid = false;

          if (ref.format === 'standard') {
            // Standard format reference like "1.6"
            const lookupKey = `${ref.chapter}.${ref.section}`;
            isValid = validSections.has(lookupKey);
          } else if (ref.format === 'prefixed') {
            // Prefixed format reference like "B01.06" or "B01.006"
            // Normalize section to 3-digit for lookup
            const sectionPadded = String(ref.section).padStart(3, '0');
            const lookupKey = `${ref.prefix}${String(ref.chapter).padStart(2, '0')}.${sectionPadded}`;
            isValid = validSectionsPrefixed.has(lookupKey);
          }

          if (!isValid) {
            referenceIssues.push({
              entry: {
                id: entry.id,
                category: entry.category,
                section: entry.section_number,
                title: entry.title
              },
              field,
              reference: ref.text,
              issue: `Reference to non-existent section ${ref.text}`,
              severity: 'high'
            });
          }
        } else if (ref.type === 'chapter') {
          if (!validChapters.has(ref.chapter)) {
            referenceIssues.push({
              entry: {
                id: entry.id,
                category: entry.category,
                section: entry.section_number,
                title: entry.title
              },
              field,
              reference: ref.text,
              issue: `Reference to non-existent Chapter ${ref.chapter}`,
              severity: 'medium'
            });
          }
        }
      });
    });
  });

  return { validSections, validChapters, referenceIssues, sectionFormatIssues };
}

// Generate report
function generateReport(entries, validationResults) {
  const { validSections, validChapters, referenceIssues, sectionFormatIssues } = validationResults;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TRINITY REFERENCE VALIDATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('📈 Statistics:');
  console.log(`   Total Entries: ${entries.length}`);
  console.log(`   Valid Sections: ${validSections.size}`);
  console.log(`   Valid Chapters: ${validChapters.size}`);
  console.log(`   Section Format Issues: ${sectionFormatIssues.length}`);
  console.log(`   Broken References: ${referenceIssues.length}`);
  console.log('');

  if (sectionFormatIssues.length === 0 && referenceIssues.length === 0) {
    console.log('✅ All section numbers are correctly formatted and all references are valid!');
    return;
  }

  // Show section format issues first
  if (sectionFormatIssues.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🟡 SECTION NUMBER FORMAT ISSUES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Expected format: [B|L|T]XX.YYY (e.g., B01.006, L12.003, T05.001) - 3-digit section numbers`);
    console.log('');

    // Show first 20 examples
    sectionFormatIssues.slice(0, 20).forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.entry.category.padEnd(8)} | Current: "${issue.entry.current}" → Expected: "${issue.entry.expected}"`);
      console.log(`   Title: ${issue.entry.title.substring(0, 60)}`);
      console.log(`   Entry ID: ${issue.entry.id}`);
      console.log('');
    });

    if (sectionFormatIssues.length > 20) {
      console.log(`... and ${sectionFormatIssues.length - 20} more format issues`);
      console.log('');
    }
  }

  // Show broken references
  if (referenceIssues.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔴 BROKEN REFERENCES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Group by severity
    const highSeverity = referenceIssues.filter(i => i.severity === 'high');
    const mediumSeverity = referenceIssues.filter(i => i.severity === 'medium');

    if (highSeverity.length > 0) {
      console.log('🔴 HIGH SEVERITY (Invalid Section References):');
      console.log('');
      highSeverity.forEach((issue, index) => {
        console.log(`${index + 1}. Entry: ${issue.entry.category} - ${issue.entry.section} - ${issue.entry.title}`);
        console.log(`   Field: ${issue.field}`);
        console.log(`   Reference: "${issue.reference}"`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Entry ID: ${issue.entry.id}`);
        console.log('');
      });
    }

    if (mediumSeverity.length > 0) {
      console.log('🟡 MEDIUM SEVERITY (Invalid Chapter References):');
      console.log('');
      mediumSeverity.forEach((issue, index) => {
        console.log(`${index + 1}. Entry: ${issue.entry.category} - ${issue.entry.section} - ${issue.entry.title}`);
        console.log(`   Field: ${issue.field}`);
        console.log(`   Reference: "${issue.reference}"`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Entry ID: ${issue.entry.id}`);
        console.log('');
      });
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Section Format Issues: ${sectionFormatIssues.length}`);
  console.log(`Broken References (High): ${referenceIssues.filter(i => i.severity === 'high').length}`);
  console.log(`Broken References (Medium): ${referenceIssues.filter(i => i.severity === 'medium').length}`);
  console.log(`Total Issues: ${sectionFormatIssues.length + referenceIssues.length}`);
  console.log('');
}

// Main execution
async function main() {
  try {
    console.log('Fetching Trinity entries...');
    const entries = await fetchAllEntries();
    console.log(`Loaded ${entries.length} entries`);
    console.log('');

    console.log('Validating references...');
    const results = validateReferences(entries);
    console.log('');

    generateReport(entries, results);

    // Exit with error code if issues found
    const totalIssues = results.sectionFormatIssues.length + results.referenceIssues.length;
    process.exit(totalIssues > 0 ? 1 : 0);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Script to replace Loader2 from lucide-react with Spinner component
 *
 * Transforms:
 *   import { Loader2 } from "lucide-react"
 *   <Loader2 className="h-4 w-4 animate-spin" />
 *
 * To:
 *   import { Spinner } from "@/components/ui/spinner"
 *   <Spinner size={16} />
 */

const fs = require('fs');
const path = require('path');

// Size mapping from Tailwind classes to pixels
const sizeMap = {
  'h-3 w-3': 12,
  'h-3.5 w-3.5': 14,
  'h-4 w-4': 16,
  'h-5 w-5': 20,
  'h-6 w-6': 24,
  'h-8 w-8': 32,
  'h-10 w-10': 40,
  'h-12 w-12': 48,
};

function extractSize(className) {
  for (const [pattern, size] of Object.entries(sizeMap)) {
    if (className.includes(pattern.split(' ')[0]) && className.includes(pattern.split(' ')[1])) {
      return size;
    }
  }
  return 20; // Default size
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if no Loader2
  if (!content.includes('Loader2')) {
    return { modified: false, changes: [] };
  }

  const changes = [];

  // Check if Spinner is already imported
  const hasSpinnerImport = content.includes('from "@/components/ui/spinner"') ||
                           content.includes("from '@/components/ui/spinner'");

  // Step 1: Add Spinner import if not present and we have Loader2 usage
  if (!hasSpinnerImport && content.includes('<Loader2')) {
    // Find a good place to add the import (after other component imports)
    const importLines = content.match(/^import .+ from ["']@\/components\/.+["'];?$/gm);
    if (importLines && importLines.length > 0) {
      const lastComponentImport = importLines[importLines.length - 1];
      content = content.replace(
        lastComponentImport,
        lastComponentImport + '\nimport { Spinner } from "@/components/ui/spinner";'
      );
      changes.push('Added Spinner import');
      modified = true;
    } else {
      // Add after lucide-react import
      const lucideImport = content.match(/^import .+ from ["']lucide-react["'];?$/m);
      if (lucideImport) {
        content = content.replace(
          lucideImport[0],
          lucideImport[0] + '\nimport { Spinner } from "@/components/ui/spinner";'
        );
        changes.push('Added Spinner import after lucide-react');
        modified = true;
      }
    }
  }

  // Step 2: Replace <Loader2 ... /> with <Spinner ... />
  // Pattern: <Loader2 className="..." />
  const loader2Pattern = /<Loader2\s+className=["']([^"']+)["']\s*\/>/g;
  let match;
  while ((match = loader2Pattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const className = match[1];
    const size = extractSize(className);

    // Extract non-size, non-animate classes
    const otherClasses = className
      .replace(/h-\d+(\.\d+)?/g, '')
      .replace(/w-\d+(\.\d+)?/g, '')
      .replace(/animate-spin/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let replacement;
    if (otherClasses) {
      replacement = `<Spinner size={${size}} className="${otherClasses}" />`;
    } else if (size === 20) {
      replacement = '<Spinner />';
    } else {
      replacement = `<Spinner size={${size}} />`;
    }

    content = content.replace(fullMatch, replacement);
    changes.push(`Replaced Loader2 (size ${size})`);
    modified = true;
  }

  // Step 3: Handle Loader2 with other patterns (inside JSX expressions, with other props)
  // Pattern: <Loader2 className={...} /> or <Loader2 className="..." {...props} />
  const complexLoader2Pattern = /<Loader2([^>]+)>/g;
  content = content.replace(complexLoader2Pattern, (match, props) => {
    if (match.includes('/>')) return match; // Already handled above

    // Extract className
    const classMatch = props.match(/className=["']([^"']+)["']/);
    if (classMatch) {
      const className = classMatch[1];
      const size = extractSize(className);
      const otherClasses = className
        .replace(/h-\d+(\.\d+)?/g, '')
        .replace(/w-\d+(\.\d+)?/g, '')
        .replace(/animate-spin/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      let newProps = props.replace(/className=["'][^"']+["']/, '');
      if (otherClasses) {
        newProps = `size={${size}} className="${otherClasses}"${newProps}`;
      } else if (size !== 20) {
        newProps = `size={${size}}${newProps}`;
      }

      changes.push(`Replaced complex Loader2 (size ${size})`);
      modified = true;
      return `<Spinner${newProps}>`;
    }

    return match;
  });

  // Step 4: Remove Loader2 from lucide-react import
  // Pattern: import { ..., Loader2, ... } from "lucide-react"
  const lucideImportPattern = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/g;
  content = content.replace(lucideImportPattern, (match, imports) => {
    const importList = imports.split(',').map(i => i.trim()).filter(i => i);
    const withoutLoader2 = importList.filter(i => i !== 'Loader2');

    if (withoutLoader2.length === 0) {
      // Remove entire import
      changes.push('Removed lucide-react import (was only Loader2)');
      modified = true;
      return '';
    } else if (withoutLoader2.length < importList.length) {
      // Loader2 was removed
      changes.push('Removed Loader2 from lucide-react import');
      modified = true;

      // Format nicely
      if (withoutLoader2.length <= 3) {
        return `import { ${withoutLoader2.join(', ')} } from "lucide-react";`;
      } else {
        return `import {\n  ${withoutLoader2.join(',\n  ')},\n} from "lucide-react";`;
      }
    }

    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
  }

  return { modified, changes };
}

// Get all files from command line or find them
const files = process.argv.slice(2);

if (files.length === 0) {
  console.log('Usage: node replace-loader2-with-spinner.js <file1> <file2> ...');
  console.log('Or pipe files: find . -name "*.tsx" | xargs node replace-loader2-with-spinner.js');
  process.exit(1);
}

let totalModified = 0;
let totalChanges = 0;

for (const file of files) {
  try {
    const { modified, changes } = processFile(file);
    if (modified) {
      totalModified++;
      totalChanges += changes.length;
      console.log(`✓ ${file}`);
      changes.forEach(c => console.log(`  - ${c}`));
    }
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

console.log(`\nDone! Modified ${totalModified} files with ${totalChanges} changes.`);

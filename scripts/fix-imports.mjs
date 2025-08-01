#!/usr/bin/env node

/**
 * Post-build script to fix ES module imports by adding .js extensions
 * This is needed because TypeScript doesn't automatically add .js extensions
 * when compiling to ES modules, but Node.js requires them.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function fixImports(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (extname(file) === '.js') {
      let content = readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix relative imports to add .js extension
      const newContent = content.replace(
        /from\s+['"](\.\/.+?)['"];?/g,
        (match, importPath) => {
          if (!importPath.endsWith('.js') && !importPath.includes('.') || importPath.match(/^\.\/[^.]+$/)) {
            modified = true;
            return match.replace(importPath, importPath + '.js');
          }
          return match;
        }
      );
      
      const finalContent = newContent.replace(
        /import\s+(['"])(\.\/.+?)\1;?/g,
        (match, quote, importPath) => {
          if (!importPath.endsWith('.js') && !importPath.includes('.') || importPath.match(/^\.\/[^.]+$/)) {
            modified = true;
            return match.replace(importPath, importPath + '.js');
          }
          return match;
        }
      );
      
      if (modified) {
        console.log(`Fixed imports in ${filePath}`);
        writeFileSync(filePath, finalContent, 'utf8');
      }
    }
  }
}

// Fix imports in the dist directory
const distDir = './dist';
console.log('Fixing ES module imports...');
fixImports(distDir);
console.log('Import fixes complete!');

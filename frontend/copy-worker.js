const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'public', 'pdf.worker.min.mjs');
const destFile = path.join(__dirname, 'out', 'pdf.worker.min.mjs');

try {
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, destFile);
    console.log('PDF worker copied to out/ directory');
  } else {
    console.error('PDF worker source file not found');
  }
} catch (error) {
  console.error('Error copying PDF worker:', error);
}

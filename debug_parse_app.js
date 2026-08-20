const fs = require('fs');
const parser = require('@babel/parser');
const path = require('path');
const filePath = path.join(__dirname, 'src', 'App.jsx');
const code = fs.readFileSync(filePath, 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('PARSE_OK');
} catch (e) {
  console.error('ERROR:', e.message);
  if (e.loc) console.error('LINE:', e.loc.line, 'COL:', e.loc.column);
  process.exit(1);
}

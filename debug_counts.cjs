const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'App.jsx');
const code = fs.readFileSync(file, 'utf8');
const counts = {
  '{': (code.match(/\{/g)||[]).length,
  '}': (code.match(/\}/g)||[]).length,
  '(': (code.match(/\(/g)||[]).length,
  ')': (code.match(/\)/g)||[]).length,
  '[': (code.match(/\[/g)||[]).length,
  ']': (code.match(/\]/g)||[]).length,
  '<': (code.match(/</g)||[]).length,
  '>': (code.match(/>/g)||[]).length,
  '`': (code.match(/`/g)||[]).length,
};
console.log(counts);

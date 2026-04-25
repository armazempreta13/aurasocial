const fs = require('fs');
const content = fs.readFileSync('components/PostCard.tsx', 'utf8');
const lines = content.split('\n');
let divCount = 0;
for (let i = 1124; i <= 1570; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<div(\s|>)/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  divCount += opens - closes;
  if (opens - closes !== 0) {
    console.log(`Line ${i+1}: delta=${opens - closes}, total=${divCount}`);
  }
}

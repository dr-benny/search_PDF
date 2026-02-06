const fs = require('fs');
const index = JSON.parse(fs.readFileSync('search_index.json', 'utf8'));
const keysWith123 = Object.keys(index).filter(k => k.includes('123'));
console.log('Keys containing "123":', keysWith123);
console.log('Key lengths:', keysWith123.map(k => k.length));
console.log('Total keys:', Object.keys(index).length);

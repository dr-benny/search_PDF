const fs = require('fs');
const indexFile = 'search_index.json';

try {
    const data = fs.readFileSync(indexFile, 'utf8');
    const searchIndex = JSON.parse(data);
    const query = '55500001';
    
    console.log('Searching for:', query);
    
    for (const [number, files] of Object.entries(searchIndex)) {
        if (number.length < 8 || number.length > 13) continue;
        
        if (number.includes(query)) {
            console.log('Match found:', number);
        }
    }
} catch (err) {
    console.error(err);
}

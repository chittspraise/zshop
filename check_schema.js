const fs = require('fs');
const sql1 = fs.readFileSync('supabase/migrations/20250106201337_remote_schema.sql', 'utf8');
console.log('SQL1 has description:', sql1.includes('description'));
console.log('SQL1 has Status:', sql1.includes('Status'));
console.log('SQL1 has maxQuantity:', sql1.includes('maxQuantity'));

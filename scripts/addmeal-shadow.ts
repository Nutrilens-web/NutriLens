import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/AddMeal.tsx'), 'utf-8');

content = content.replace(/shadow-sm/g, 'shadow-[0_4px_20px_rgba(0,0,0,0.05)]');

fs.writeFileSync(path.resolve('src/screens/AddMeal.tsx'), content);
console.log('AddMeal shadow updated');

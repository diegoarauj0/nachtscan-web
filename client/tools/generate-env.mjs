import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
//Gerado por IA (Odeio o Angular -_-)
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const mode = process.argv.includes('--development') ? 'development' : 'production';

dotenv.config({ path: resolve(root, '.env') });

const content = `export const environment = {
  production: ${mode === 'production'},
  apiUrl: '${process.env.API_URL || 'http://localhost:3000'}',
};
`;

writeFileSync(resolve(root, 'src', 'environments', 'environment.ts'), content);
console.log(`[generate-env] Generated environment.ts (mode: ${mode})`);

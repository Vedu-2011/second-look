// Decode the actual encoded end-card frame locally. Dependencies are isolated from the app.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(root+'/video/work/qr-tools/package.json');
const jsQR=require('jsqr'),{PNG}=require('pngjs');
const png=PNG.sync.read(fs.readFileSync(process.argv[2]));
const value=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
console.log(JSON.stringify(value?[value.data]:[]));

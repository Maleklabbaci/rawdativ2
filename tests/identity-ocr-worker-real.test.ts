import {test} from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {readImage,chooseResult} from '../server/identity-ocr/worker';
test('self-hosted OCR reads a synthetic card without network or disk cache', {timeout:90000},async()=>{
 const svg=Buffer.from(`<svg width="1100" height="620" xmlns="http://www.w3.org/2000/svg"><rect width="1100" height="620" fill="white"/><text x="80" y="110" font-size="36" font-family="DejaVu Sans">CARTE FICTIVE</text><text x="80" y="240" font-size="50" font-family="DejaVu Sans">NOM : BENALI</text><text x="80" y="340" font-size="50" font-family="DejaVu Sans">PRENOM : AMEL</text></svg>`);
 const image=await sharp(svg).png().toBuffer();const result=chooseResult(await readImage(image),{first:'Amel',last:'Benali'});assert.equal(result.result,'matched');assert.equal(result.first,'AMEL');assert.equal(result.last,'BENALI');
});

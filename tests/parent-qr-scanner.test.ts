import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { parseParentInviteLink } from '../src/utils/parentInviteLink';

test('camera decoder reads a personal QR, then validates its origin and secret', async () => {
 const token = 'a'.repeat(64);
 const origin = 'https://rawdha.example';
 const link = `${origin}/espace-parent?creche=test&nom=Creche#enfant=${token}`;
 const png = await QRCode.toBuffer(link, { width: 500, margin: 2, errorCorrectionLevel: 'M' });
 const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
 assert.equal(decoded?.data,link);
 assert.equal(parseParentInviteLink(decoded!.data,origin), `/espace-parent?creche=test&nom=Creche#enfant=${token}`);
 assert.equal(parseParentInviteLink(decoded!.data,'https://other.example'),null);
});

/**
 * Lecteur local 100 % navigateur (conforme Loi 18-07, zéro serveur tiers) pour :
 * - Fichiers Microsoft Excel `.xlsx` (ZIP Central Directory + Deflate-raw + XML Worksheet)
 * - Fichiers `.csv` / `.tsv` (séparateurs `;`, `,` ou tabulation `\t`)
 * - Copier-coller direct depuis Excel / Google Sheets (lignes séparées par `\t`)
 */

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const copy = new Uint8Array(compressed.byteLength);
    copy.set(compressed);
    void writer.write(copy);
    void writer.close();
    const response = new Response(ds.readable);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  const nodeZlibModule = 'node:' + 'zlib';
  const zlib = await import(/* @vite-ignore */ nodeZlibModule);
  return new Uint8Array(zlib.inflateRawSync(compressed));
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

async function extractZipEntries(zipBytes: Uint8Array): Promise<Map<string, string>> {
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, string>();

  // Recherche de l'End of Central Directory (EOCD : 0x06054b50) depuis la fin
  let eocdOffset = -1;
  const minOffset = Math.max(0, zipBytes.length - 65557);
  for (let i = zipBytes.length - 22; i >= minOffset; i -= 1) {
    if (
      zipBytes[i] === 0x50 &&
      zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 &&
      zipBytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('invalid_xlsx_archive');
  }

  const totalEntries = readUint16LE(zipBytes, eocdOffset + 10);
  const centralDirOffset = readUint32LE(zipBytes, eocdOffset + 16);

  let ptr = centralDirOffset;
  for (let idx = 0; idx < totalEntries && ptr + 46 <= zipBytes.length; idx += 1) {
    if (readUint32LE(zipBytes, ptr) !== 0x02014b50) break;
    const compressionMethod = readUint16LE(zipBytes, ptr + 10);
    const compressedSize = readUint32LE(zipBytes, ptr + 20);
    const fileNameLen = readUint16LE(zipBytes, ptr + 28);
    const extraLen = readUint16LE(zipBytes, ptr + 30);
    const commentLen = readUint16LE(zipBytes, ptr + 32);
    const localHeaderOffset = readUint32LE(zipBytes, ptr + 42);

    const fileName = decoder.decode(zipBytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (!fileName.endsWith('.xml')) continue;
    if (localHeaderOffset + 30 > zipBytes.length) continue;
    if (readUint32LE(zipBytes, localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = readUint16LE(zipBytes, localHeaderOffset + 26);
    const localExtraLen = readUint16LE(zipBytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawSlice = zipBytes.subarray(dataStart, dataStart + compressedSize);

    let uncompressed: Uint8Array;
    if (compressionMethod === 0) {
      uncompressed = rawSlice;
    } else if (compressionMethod === 8) {
      uncompressed = await inflateRawBytes(rawSlice);
    } else {
      continue;
    }

    entries.set(fileName, decoder.decode(uncompressed));
  }

  return entries;
}

function columnLettersToIndex(cellRef: string): number {
  const match = /^([A-Za-z]+)/.exec(cellRef);
  if (!match) return -1;
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseSharedStringsXml(xml?: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const inner = siMatch[1];
    const parts: string[] = [];
    const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(inner)) !== null) {
      parts.push(decodeXmlEntities(tMatch[1]));
    }
    strings.push(parts.join(''));
  }
  return strings;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const rowCells: string[] = [];
    let fallbackCol = 0;
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const attrs = cellMatch[1] || '';
      const content = cellMatch[2] || '';
      const refMatch = /\br="([A-Za-z]+\d+)"/.exec(attrs);
      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch ? typeMatch[1] : '';

      const colIndex = refMatch ? columnLettersToIndex(refMatch[1]) : fallbackCol;
      fallbackCol = Math.max(fallbackCol, colIndex) + 1;

      let textValue = '';
      if (cellType === 'inlineStr') {
        const tParts: string[] = [];
        const tReg = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
        let m: RegExpExecArray | null;
        while ((m = tReg.exec(content)) !== null) {
          tParts.push(decodeXmlEntities(m[1]));
        }
        textValue = tParts.join('');
      } else {
        const vMatch = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(content);
        const rawV = vMatch ? decodeXmlEntities(vMatch[1]).trim() : '';
        if (cellType === 's') {
          const idx = parseInt(rawV, 10);
          textValue = Number.isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
        } else if (cellType === 'b') {
          textValue = rawV === '1' ? 'Oui' : 'Non';
        } else {
          textValue = rawV;
        }
      }

      if (colIndex >= 0) {
        while (rowCells.length <= colIndex) rowCells.push('');
        rowCells[colIndex] = textValue.trim();
      }
    }

    if (rowCells.some(cell => cell.trim().length > 0)) {
      rows.push(rowCells);
    }
  }

  return rows;
}

export function isXlsxFile(file: { name?: string; type?: string }, bytes?: Uint8Array): boolean {
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.xlsx')) return true;
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return true;
  }
  if (bytes && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return true;
  }
  return false;
}

export async function parseXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const entries = await extractZipEntries(bytes);
  const sharedStrings = parseSharedStringsXml(entries.get('xl/sharedStrings.xml'));
  const sheetXml =
    entries.get('xl/worksheets/sheet1.xml') ||
    Array.from(entries.entries())
      .filter(([name]) => name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml'))
      .sort(([a], [b]) => a.localeCompare(b))[0]?.[1];

  if (!sheetXml) {
    throw new Error('missing_worksheet');
  }
  return parseWorksheetXml(sheetXml, sharedStrings);
}

export function parseCsvLineCells(line: string, separator: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

export function parseDelimitedSpreadsheetText(rawText: string): {
  separator: string;
  rows: string[][];
} {
  const clean = rawText.replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r?\n/)
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return { separator: ';', rows: [] };
  }

  const headerLine = lines[0];
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  const separator =
    tabCount > semiCount && tabCount > commaCount
      ? '\t'
      : semiCount >= commaCount && semiCount > 0
      ? ';'
      : ',';

  const rows = lines.map(line => parseCsvLineCells(line, separator));
  return { separator, rows };
}

/**
 * Convertit une date Excel (numéro de série type `45184` ou formats `JJ/MM/AAAA`, `AAAA-MM-JJ`) en `AAAA-MM-JJ`.
 */
export function normalizeSpreadsheetDate(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // Numéro de série Excel (ex: 44562 -> 2022-01-01)
  if (/^\d{5}(?:\.\d+)?$/.test(trimmed)) {
    const serial = Math.floor(Number(trimmed));
    if (serial >= 30000 && serial <= 60000) {
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86_400_000;
      const date = new Date(utcMs);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dmy = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  const ymdSlash = /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/.exec(trimmed);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;
  }

  return '';
}

export function buildChildrenImportTemplateCsv(isArabic = false): string {
  const headers = isArabic
    ? ['اللقب', 'الاسم', 'تاريخ الميلاد', 'الجنس', 'الفئة', 'لقب الولي', 'اسم الولي', 'الهاتف', 'البريد الإلكتروني']
    : ['Nom', 'Prénom', 'Date de naissance', 'Genre', 'Groupe', 'Nom du parent', 'Prénom du parent', 'Téléphone du parent', 'E-mail du parent'];

  const sample1 = isArabic
    ? ['بن عيسى', 'آدم', '15/03/2023', 'ذكر', 'متوسطون', 'بن عيسى', 'نادية', '0555123456', 'nadia@example.dz']
    : ['Benaissa', 'Adam', '15/03/2023', 'Garçon', 'Moyens', 'Benaissa', 'Nadia', '0555123456', 'nadia@example.dz'];

  const sample2 = isArabic
    ? ['مراد', 'لينة', '02/09/2024', 'أنثى', 'رضع', 'مراد', 'كريم', '0661987654', '']
    : ['Merad', 'Lina', '02/09/2024', 'Fille', 'Bébés', 'Merad', 'Karim', '0661987654', ''];

  return '\uFEFF' + [headers, sample1, sample2].map(row => row.join(';')).join('\r\n') + '\r\n';
}

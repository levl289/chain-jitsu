/**
 * Minimal RFC-4180-style CSV parser.
 *
 * Handles quoted fields, escaped quotes ("") and newlines inside quotes — which
 * the source deck relies on (front_text and many prompt columns are multi-line).
 * Returns an array of row objects keyed by the header row.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0];
  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully blank trailing lines.
    if (cells.length === 1 && cells[0] === '') {
      continue;
    }
    const record: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      record[header[c]] = cells[c] ?? '';
    }
    records.push(record);
  }
  return records;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  // Normalise CRLF -> LF so quoted newlines are consistent.
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // Flush the final field/row if the file did not end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

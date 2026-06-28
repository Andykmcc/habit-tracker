export const serializeRows = (rows: string[][]): string => {
  const escape = (str: string): string => {
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return rows.map(row => row.map(escape).join(',')).join('\n');
};

export const parseRows = (text: string): string[][] => {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') {
      pushField(); pushRow();
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') { pushField(); pushRow(); i++; continue; }
    field += ch; i++;
  }

  if (inQuotes) throw new Error('Unterminated quoted field in CSV');
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }

  // Drop fully-blank lines (a single empty field).
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
};

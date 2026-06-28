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
  let fieldQuoted = false;   // this field contained an opening quote
  let row: string[] = [];
  let rowHasContent = false; // any field was quoted/non-empty, or the row had a separator
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    if (field !== '' || fieldQuoted) rowHasContent = true;
    field = '';
    fieldQuoted = false;
  };
  const pushRow = () => {
    if (rowHasContent) rows.push(row); // skip genuinely blank lines
    row = [];
    rowHasContent = false;
  };

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; fieldQuoted = true; i++; continue; }
    if (ch === ',') { pushField(); rowHasContent = true; i++; continue; }
    if (ch === '\r') {
      pushField(); pushRow();
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') { pushField(); pushRow(); i++; continue; }
    field += ch; i++;
  }

  if (inQuotes) throw new Error('Unterminated quoted field in CSV');
  if (field !== '' || fieldQuoted || row.length > 0) { pushField(); pushRow(); }

  return rows;
};

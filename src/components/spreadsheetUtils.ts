/** 从 ReactMarkdown HAST node 提取表格数据 */
export function extractTableFromHAST(node: any): { headers: string[]; rows: string[][] } | null {
  try {
    if (!node || !node.children) return null;
    const headers: string[] = [];
    const rows: string[][] = [];
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      if (child.tagName === 'thead') {
        const tr = child.children?.find((c: any) => c.tagName === 'tr');
        if (tr) {
          for (const th of tr.children || []) {
            if (th.tagName === 'th' || th.tagName === 'td') headers.push(extractNodeText(th));
          }
        }
      }
      if (child.tagName === 'tbody') {
        for (const tr of child.children || []) {
          if (tr.tagName !== 'tr') continue;
          const row: string[] = [];
          for (const td of tr.children || []) {
            if (td.tagName === 'td' || td.tagName === 'th') row.push(extractNodeText(td));
          }
          if (row.length > 0) rows.push(row);
        }
      }
    }
    if (headers.length === 0 && rows.length === 0) return null;
    return { headers, rows };
  } catch { return null; }
}

function extractNodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (node.children) return node.children.map(extractNodeText).join('');
  return '';
}

/** 解析 CSV/TSV 文本 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const separator = lines[0].includes('\t') ? '\t' : ',';
  const parse = (line: string) => {
    const fields: string[] = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) { inQuotes = true; continue; }
      if (ch === '"' && inQuotes) { if (line[i+1] === '"') { current += '"'; i++; continue; } inQuotes = false; continue; }
      if (ch === separator && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return fields;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse);
  const maxCols = Math.max(headers.length, ...rows.map(r => r.length));
  while (headers.length < maxCols) headers.push('');
  for (const row of rows) while (row.length < maxCols) row.push('');
  return { headers, rows };
}

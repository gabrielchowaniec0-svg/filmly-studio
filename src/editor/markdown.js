// Tiny Markdown renderer for the Help panel (headings, code fences, tables, lists, paragraphs, inline code,
// bold, italics, links). Pure: returns HTML strings. FilmScript code blocks get light syntax colouring.

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function inline(s) {
  const parts = [];
  // protect code spans first
  s = s.replace(/`([^`]+)`/g, (_, c) => { parts.push(`<code>${esc(c)}</code>`); return `\u0000${parts.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => parts[+i]);
}

/** Colour FilmScript: comments, strings, keywords, numbers. */
export function highlightFly(code) {
  return code.split('\n').map((line) => {
    let out = '', i = 0;
    const kw = /^(film|scene|cast|character|voice|let|transition|fade|wait|at|hold|caption|title|camera|music|sfx|ambience|effect|prop|par|repeat|from|over|to|in|out|hidden|for)\b/;
    while (i < line.length) {
      const rest = line.slice(i);
      let m;
      if (rest[0] === '#' && !/=\s*$/.test(line.slice(0, i))) { out += `<span class="c">${esc(rest)}</span>`; break; }
      if ((m = /^"(?:[^"\\]|\\.)*"?/.exec(rest)) && rest[0] === '"') { out += `<span class="s">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if ((m = /^-?\d+(?:\.\d+)?(?:ms|s|%|x\d+)?/.exec(rest)) && !/\w$/.test(line.slice(0, i))) { out += `<span class="n">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][\w.]*(?==)/.exec(rest))) { out += `<span class="p">${esc(m[0])}</span>`; i += m[0].length; continue; }
      if ((m = kw.exec(rest)) && !/[\w.]$/.test(line.slice(0, i))) { out += `<span class="k">${m[0]}</span>`; i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][\w.-]*/.exec(rest))) { out += esc(m[0]); i += m[0].length; continue; }
      out += esc(rest[0]); i++;
    }
    return out;
  }).join('\n');
}

/** Split into sections by heading: [{level, title, id, md}] (text before the first heading is level 0). */
export function sections(md) {
  const out = [];
  let cur = { level: 0, title: '', id: 'top', md: '' };
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    const h = !inFence && /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      if (cur.md.trim() || cur.title) out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), id: h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), md: '' };
    } else cur.md += line + '\n';
  }
  out.push(cur);
  return out;
}

export function renderMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '';
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if ((m = /^```(\w*)/.exec(line))) {
      flush();
      const lang = m[1];
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join('\n');
      html += `<pre class="code${lang ? ' ' + esc(lang) : ''}"><button class="copy" data-copy>Copy</button><code>${!lang || lang === 'fly' ? highlightFly(code) : esc(code)}</code></pre>`;
      continue;
    }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flush();
      const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h${m[1].length} id="h-${id}">${inline(m[2])}</h${m[1].length}>`;
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const isSep = (r) => /^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes('-');
      const head = rows.length > 1 && isSep(rows[1]) ? cells(rows[0]) : null;
      const body = rows.slice(head ? 2 : 0);
      html += '<table>' + (head && head.some(Boolean) ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : '')
        + `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      html += `<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      html += `<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return html;
}

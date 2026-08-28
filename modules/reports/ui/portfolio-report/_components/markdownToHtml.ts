export function mdToHtml(text: string): string {
  const fmt = (s: string) => s
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');
  const lines = text.split('\n');
  let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.75;padding:28px;background:white;">';
  let inUl = false; let inOl = false;
  lines.forEach(line => {
    const isBullet = /^[-*]\s/.test(line); const isOrdered = /^\d+\.\s/.test(line);
    if (!isBullet && inUl) { html += '</ul>'; inUl = false; }
    if (!isOrdered && inOl) { html += '</ol>'; inOl = false; }
    if (/^###\s/.test(line)) {
      html += `<h3 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin:18px 0 6px;">${fmt(line.replace(/^###\s/,''))}</h3>`;
    } else if (/^##\s/.test(line)) {
      html += `<h2 style="font-size:16px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:24px 0 10px;">${fmt(line.replace(/^##\s/,''))}</h2>`;
    } else if (/^#\s/.test(line)) {
      html += `<h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 16px;">${fmt(line.replace(/^#\s/,''))}</h1>`;
    } else if (isBullet) {
      if (!inUl) { html += '<ul style="margin:6px 0;padding-left:22px;">'; inUl = true; }
      html += `<li style="margin:4px 0;color:#334155;">${fmt(line.replace(/^[-*]\s/,''))}</li>`;
    } else if (isOrdered) {
      if (!inOl) { html += '<ol style="margin:6px 0;padding-left:22px;">'; inOl = true; }
      html += `<li style="margin:4px 0;color:#334155;">${fmt(line.replace(/^\d+\.\s/,''))}</li>`;
    } else if (line.trim() === '') {
      html += '<div style="height:8px;"></div>';
    } else {
      html += `<p style="margin:5px 0;color:#334155;">${fmt(line)}</p>`;
    }
  });
  if (inUl) html += '</ul>'; if (inOl) html += '</ol>';
  html += '</div>'; return html;
}

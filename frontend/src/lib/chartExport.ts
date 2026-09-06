/**
 * Save a Recharts (SVG) chart as a PNG: serialise the SVG with its computed
 * text styles, paint it on a canvas at 2x, and trigger a download. No
 * dependencies; fonts fall back to the system stack inside the image.
 */
export async function downloadChartPng(container: HTMLElement, filename: string, title?: string): Promise<boolean> {
  const svg = container.querySelector('svg.recharts-surface') as SVGSVGElement | null;
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = svg.clientWidth || Number(svg.getAttribute('width')) || 800;
  const height = svg.clientHeight || Number(svg.getAttribute('height')) || 400;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // Inline the few text styles Recharts sets through CSS.
  clone.querySelectorAll('text, tspan').forEach((el) => {
    const e = el as SVGElement;
    if (!e.getAttribute('font-family')) e.setAttribute('font-family', 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
  });
  const header = title ? 40 : 0;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale; canvas.height = (height + header + 24) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height + header + 24);
  if (title) { ctx.fillStyle = '#1c1917'; ctx.font = '600 15px Inter, system-ui, sans-serif'; ctx.fillText(title, 12, 26); }
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, header, width, height); URL.revokeObjectURL(url); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg render failed')); };
    img.src = url;
  });
  ctx.fillStyle = '#78716c'; ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('chrispeterkins.com/paschools · Pennsylvania Department of Education data', 12, height + header + 16);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) return false;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(png); a.download = `${filename.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

/** Share the current page (Web Share API) or copy its URL to the clipboard. Returns what happened. */
export async function sharePage(title: string, text?: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = window.location.href;
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return 'shared'; }
  } catch { /* user cancelled or unsupported; fall through to copy */ }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'failed'; }
}

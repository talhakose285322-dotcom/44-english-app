// A tiny, valid one-page PDF with real (selectable) text, built in code so the repository holds no binary fixture.
// The text is long enough that the app treats it as a text PDF (no OCR offer).
export const PDF_LINES = [
  'The river flows quietly past the old town.',
  'People walk along it every evening and talk.',
  'In winter the water turns grey and very cold.',
  'Children throw small stones into the river.',
  'The old bridge was built more than a century ago.'
];
export function makePdf(lines = PDF_LINES) {
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
  const content = 'BT /F1 14 Tf 72 720 Td 20 TL\n' + lines.map(l => `(${esc(l)}) Tj T*`).join('\n') + '\nET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`
  ];
  let out = '%PDF-1.4\n';
  const offs = objs.map((o, i) => { const at = Buffer.byteLength(out, 'latin1'); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

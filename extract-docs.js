const fs = require('fs');

const SRC = 'C:/Users/danie/AppData/Local/Temp/claude/C--Users-danie-Desktop-egenya-trackt-2/88acaa26-727b-48e6-8e31-1c9da2b8ac38/tasks/wa23d3m3x.output';
const OUTDIR = 'C:/Users/danie/Desktop/egenya/trackt-2/trackt-app/documentacion';

const raw = fs.readFileSync(SRC, 'utf8');
console.log('raw bytes:', raw.length);
console.log('first 120 chars:', JSON.stringify(raw.slice(0, 120)));

let obj;
try {
  obj = JSON.parse(raw);
  console.log('parsed top-level JSON OK. keys:', Object.keys(obj).join(','));
} catch (e) {
  console.log('top-level parse failed:', e.message);
  process.exit(1);
}

// dig into .result (may be object or JSON string)
let res = obj.result;
if (typeof res === 'string') {
  console.log('result is string, len', res.length, '- attempting parse');
  try { res = JSON.parse(res); } catch (e) { console.log('result parse failed:', e.message); }
}
console.log('result type:', typeof res, '| keys:', res && typeof res === 'object' ? Object.keys(res).join(',') : '(n/a)');
obj = res;

function decodeEntities(s) {
  if (!/&(gt|lt|amp|quot|#39|#x27);/.test(s)) return s;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripPreamble(md) {
  // keep from the first markdown H1/H2 heading line onward
  const m = md.match(/(^|\n)(# |## )/);
  if (!m) return md;
  return md.slice(md.indexOf(m[2], m.index)).replace(/^\s+/, '');
}

function process(name, val) {
  if (typeof val !== 'string') { console.log(name, 'NOT a string:', typeof val); return; }
  let md = decodeEntities(val);
  md = stripPreamble(md);
  if (!md.endsWith('\n')) md += '\n';
  const path = OUTDIR + '/' + name;
  fs.writeFileSync(path, md, 'utf8');
  console.log('WROTE', path, '| chars:', md.length, '| lines:', md.split('\n').length);
  console.log('   head:', JSON.stringify(md.slice(0, 90)));
}

process('flujos-usuarios.md', obj.flujosMd);
process('analisis-mejoras.md', obj.analisisMd);
console.log('stats:', JSON.stringify(obj.stats));

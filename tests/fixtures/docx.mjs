// A minimal, valid .docx (ZIP) built in code, so the repository holds no binary fixture.
// bodyXml is the content of <w:body>; store=true writes the entries uncompressed (ZIP method 0).
import zlib from 'node:zlib';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export function makeDocx(bodyXml, {store = false, document = true} = {}) {
  const files = [['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>']];
  if (document) files.push(['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${bodyXml}</w:body></w:document>`]);
  return makeZip(files, store);
}

export function makeZip(files, store = false) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8'), body = store ? data : zlib.deflateRawSync(data), nm = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data), method = store ? 0 : 8;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    locals.push(lh, nm, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nm);
    offset += 30 + nm.length + body.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

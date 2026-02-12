const pdfParse = require('/home/runner/workspace/node_modules/pdf-parse');

const _write = process.stdout.write.bind(process.stdout);
console.warn = function() {};
console.log = function() {};
process.stdout.write = function(data) {
  if (typeof data === 'string' && data.startsWith('Warning:')) return true;
  return _write(data);
};

process.stdin.resume();
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', async () => {
  try {
    const buffer = Buffer.concat(chunks);
    const result = await pdfParse(buffer);
    process.stdout.write = _write;
    _write(JSON.stringify({ text: result.text, numpages: result.numpages }));
    process.exit(0);
  } catch (err) {
    process.stderr.write(err.message || 'Unknown error');
    process.exit(1);
  }
});

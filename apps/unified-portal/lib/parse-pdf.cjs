const pdfParse = require('/home/runner/workspace/node_modules/pdf-parse');

process.stdin.resume();
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', async () => {
  try {
    const buffer = Buffer.concat(chunks);
    const result = await pdfParse(buffer);
    process.stdout.write(JSON.stringify({ text: result.text, numpages: result.numpages }));
    process.exit(0);
  } catch (err) {
    process.stderr.write(err.message);
    process.exit(1);
  }
});

global.DOMMatrix = global.DOMMatrix || class DOMMatrix {};
try {
  const pdfParse = require('pdf-parse');
  console.log("pdf-parse loaded successfully!");
} catch (e) {
  console.error("Error:", e.message);
}

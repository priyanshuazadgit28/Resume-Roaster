// Polyfill DOMMatrix for pdf-parse (pdfjs-dist) in Node.js
if (typeof DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {};
}

const pdfParse = require('pdf-parse');
const ApiError = require('../utils/apiError');

const extractText = async (buffer) => {
  let data;
  try {
    data = await pdfParse(buffer);
    const text = data.text.trim();

    // If the text is empty or unusually short, it's likely a scanned/image-only PDF
    if (!text || text.length < 50) {
      throw new ApiError(
        400,
        'This appears to be a scanned or image-only PDF. Please upload a text-based PDF.'
      );
    }

    return {
      text,
      meta: {
        pageCount: data.numpages,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, `Failed to parse PDF: ${error.message}`);
  }
};

module.exports = {
  extractText,
};

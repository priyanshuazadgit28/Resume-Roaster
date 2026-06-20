const Diff = require('diff');

const diffText = (oldText, newText, mode = 'word') => {
  let parts;
  if (mode === 'line') {
    parts = Diff.diffLines(oldText, newText);
  } else {
    parts = Diff.diffWords(oldText, newText);
  }

  // Map to just the fields we care about
  return parts.map((part) => ({
    value: part.value,
    added: !!part.added,
    removed: !!part.removed,
  }));
};

const summarizeDiff = (parts) => {
  let charsAdded = 0;
  let charsRemoved = 0;

  parts.forEach((part) => {
    if (part.added) {
      charsAdded += part.value.length;
    } else if (part.removed) {
      charsRemoved += part.value.length;
    }
  });

  return { charsAdded, charsRemoved };
};

module.exports = {
  diffText,
  summarizeDiff,
};

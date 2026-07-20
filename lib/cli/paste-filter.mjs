// Bracketed-paste filter for the REPL input stream.
//
// When the terminal's bracketed-paste mode is enabled (ESC [ ? 2004 h), pasted
// text arrives wrapped in ESC [ 200 ~ ... ESC [ 201 ~. Node's readline treats the
// newlines embedded in that block as separate line submissions, so a single
// multi-line paste is fragmented into several inputs (and any line starting with
// "/" trips the unknown-command warning). This filter strips the paste markers
// and collapses CR/LF *inside* a paste to single spaces, so the whole paste lands
// on one input line — submitted once, when the user presses Enter.
//
// It is a pure transform (no I/O) so it can be unit-tested; the caller pipes real
// stdin through it into readline. Terminals without bracketed-paste support never
// emit the markers, so everything passes through untouched (legacy behavior).

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

// Longest suffix of `s` that is a (proper) prefix of `marker`. Used to hold back
// a marker that was split across a chunk boundary so it isn't emitted as literal
// bytes.
function partialSuffix(s, marker) {
  const max = Math.min(s.length, marker.length - 1);
  for (let n = max; n > 0; n--) {
    if (s.endsWith(marker.slice(0, n))) return n;
  }
  return 0;
}

function collapseNewlines(text) {
  return text.replace(/\r\n|\r|\n/g, " ");
}

// Returns a stateful `feed(chunkString) -> stringToForward` function. State
// (in-paste flag + a carry buffer for split markers) lives in the closure.
export function createPasteFilter() {
  let inPaste = false;
  let carry = "";

  return function feed(chunk) {
    const s = carry + chunk;
    carry = "";
    let out = "";
    let i = 0;

    while (i < s.length) {
      const marker = inPaste ? PASTE_END : PASTE_START;
      const idx = s.indexOf(marker, i);
      if (idx === -1) {
        const rest = s.slice(i);
        let hold = partialSuffix(rest, marker);
        // A bare trailing ESC outside a paste is almost always a real keypress
        // (Escape, or the lead byte of an arrow/meta sequence that already
        // arrived whole), not a split paste marker — forward it immediately so
        // the clear-line/meta keys keep working. Inside a paste there is no
        // interactive cost to holding, so keep the partial.
        if (!inPaste && hold === 1) hold = 0;
        const emit = hold ? rest.slice(0, rest.length - hold) : rest;
        out += inPaste ? collapseNewlines(emit) : emit;
        carry = hold ? rest.slice(rest.length - hold) : "";
        break;
      }
      const segment = s.slice(i, idx);
      out += inPaste ? collapseNewlines(segment) : segment;
      i = idx + marker.length;
      inPaste = !inPaste;
    }

    return out;
  };
}

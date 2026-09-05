/**
 * arabicReshaper.js
 * Unicode Arabic text reshaping utility for Canvas, html2canvas, and SVG export.
 * Converts basic Arabic Unicode characters into Arabic Presentation Forms-B
 * (Initial, Medial, Final, Isolated) so that canvas text engines render
 * fully-connected, cursive Arabic ligatures without disconnected letters.
 */

const ARABIC_MAP = {
  // [isolated, initial, medial, final, connectsNext]
  '\u0621': ['\uFE80', '\uFE80', '\uFE80', '\uFE80', false], // Hamza
  '\u0622': ['\uFE81', '\uFE81', '\uFE82', '\uFE82', false], // Alef with Madda
  '\u0623': ['\uFE83', '\uFE83', '\uFE84', '\uFE84', false], // Alef with Hamza Above
  '\u0624': ['\uFE85', '\uFE85', '\uFE86', '\uFE86', false], // Waw with Hamza
  '\u0625': ['\uFE87', '\uFE87', '\uFE88', '\uFE88', false], // Alef with Hamza Below
  '\u0626': ['\uFE89', '\uFE8B', '\uFE8C', '\uFE8A', true],  // Yeh with Hamza
  '\u0627': ['\uFE8D', '\uFE8D', '\uFE8E', '\uFE8E', false], // Alef
  '\u0628': ['\uFE8F', '\uFE91', '\uFE92', '\uFE90', true],  // Beh
  '\u0629': ['\uFE93', '\uFE93', '\uFE94', '\uFE94', false], // Teh Marbuta
  '\u062A': ['\uFE95', '\uFE97', '\uFE98', '\uFE96', true],  // Teh
  '\u062B': ['\uFE99', '\uFE9B', '\uFE9C', '\uFE9A', true],  // Theh
  '\u062C': ['\uFE9D', '\uFE9F', '\uFEA0', '\uFE9E', true],  // Jeem
  '\u062D': ['\uFEA1', '\uFEA3', '\uFEA4', '\uFEA2', true],  // Hah
  '\u062E': ['\uFEA5', '\uFEA7', '\uFEA8', '\uFEA6', true],  // Khah
  '\u062F': ['\uFEA9', '\uFEA9', '\uFEAA', '\uFEAA', false], // Dal
  '\u0630': ['\uFEAB', '\uFEAB', '\uFEAC', '\uFEAC', false], // Thal
  '\u0631': ['\uFEAD', '\uFEAD', '\uFEAE', '\uFEAE', false], // Reh
  '\u0632': ['\uFEAF', '\uFEAF', '\uFEB0', '\uFEB0', false], // Zain
  '\u0633': ['\uFEB1', '\uFEB3', '\uFEB4', '\uFEB2', true],  // Seen
  '\u0634': ['\uFEB5', '\uFEB7', '\uFEB8', '\uFEB6', true],  // Sheen
  '\u0635': ['\uFEB9', '\uFEBB', '\uFEBC', '\uFEBA', true],  // Sad
  '\u0636': ['\uFEBD', '\uFEBF', '\uFEC0', '\uFEBE', true],  // Dad
  '\u0637': ['\uFEC1', '\uFEC3', '\uFEC4', '\uFEC2', true],  // Tah
  '\u0638': ['\uFEC5', '\uFEC7', '\uFEC8', '\uFEC6', true],  // Zah
  '\u0639': ['\uFEC9', '\uFECB', '\uFECC', '\uFECA', true],  // Ain
  '\u063A': ['\uFECD', '\uFECF', '\uFED0', '\uFECE', true],  // Ghain
  '\u0641': ['\uFED1', '\uFED3', '\uFED4', '\uFED2', true],  // Feh
  '\u0642': ['\uFED5', '\uFED7', '\uFED8', '\uFED6', true],  // Qaf
  '\u0643': ['\uFED9', '\uFEDB', '\uFEDC', '\uFEDA', true],  // Kaf
  '\u0644': ['\uFEDD', '\uFEDF', '\uFEE0', '\uFEDE', true],  // Lam
  '\u0645': ['\uFEE1', '\uFEE3', '\uFEE4', '\uFEE2', true],  // Meem
  '\u0646': ['\uFEE5', '\uFEE7', '\uFEE8', '\uFEE6', true],  // Noon
  '\u0647': ['\uFEE9', '\uFEEB', '\uFEEC', '\uFEEA', true],  // Heh
  '\u0648': ['\uFEED', '\uFEED', '\uFEEE', '\uFEEE', false], // Waw
  '\u0649': ['\uFEEF', '\uFEEF', '\uFEF0', '\uFEF0', false], // Alef Maksura
  '\u064A': ['\uFEF1', '\uFEF3', '\uFEF4', '\uFEF2', true],  // Yeh
  '\u0671': ['\uFB50', '\uFB50', '\uFB51', '\uFB51', false], // Alef Wasla
  '\u0679': ['\uFB66', '\uFB68', '\uFB69', '\uFB67', true],  // Tteh (Urdu)
  '\u067E': ['\uFB56', '\uFB58', '\uFB59', '\uFB57', true],  // Peh (Persian/Urdu)
  '\u0686': ['\uFB7A', '\uFB7C', '\uFB7D', '\uFB7B', true],  // Tcheh (Ch)
  '\u06A9': ['\uFB8E', '\uFB90', '\uFB91', '\uFB8F', true],  // Keheh (Kaf)
  '\u06AF': ['\uFB92', '\uFB94', '\uFB95', '\uFB93', true],  // Gaf (Galiakot)
  '\u06D2': ['\uFBAE', '\uFBAE', '\uFBAF', '\uFBAF', false], // Yeh Barree
};

// Tashkeel / Harakat characters to ignore for connectivity checks
const isTashkeel = (c) => c >= '\u064B' && c <= '\u065F';

export function reshapeArabic(text) {
  if (!text || typeof text !== 'string') return '';

  const chars = Array.from(text);
  const out = [];

  const getPrevChar = (idx) => {
    for (let k = idx - 1; k >= 0; k--) {
      if (!isTashkeel(chars[k])) return chars[k];
    }
    return null;
  };

  const getNextChar = (idx) => {
    for (let k = idx + 1; k < chars.length; k++) {
      if (!isTashkeel(chars[k])) return chars[k];
    }
    return null;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    // Preserve whitespace, punctuation, English, numbers, Tashkeel directly
    if (isTashkeel(ch) || !ARABIC_MAP[ch]) {
      out.push(ch);
      continue;
    }

    const map = ARABIC_MAP[ch];

    // Special Lam-Alef ligature handling
    if (ch === '\u0644') {
      const next = getNextChar(i);
      let lig = null;
      if (next === '\u0622') lig = ['\uFEF5', '\uFEF6']; // Lam-Alef Madda
      else if (next === '\u0623') lig = ['\uFEF7', '\uFEF8']; // Lam-Alef Hamza Above
      else if (next === '\u0625') lig = ['\uFEF9', '\uFEFA']; // Lam-Alef Hamza Below
      else if (next === '\u0627') lig = ['\uFEFB', '\uFEFC']; // Lam-Alef Plain
      if (lig) {
        const prev = getPrevChar(i);
        const prevConnects = prev && ARABIC_MAP[prev] && ARABIC_MAP[prev][4];
        out.push(prevConnects ? lig[1] : lig[0]);
        // Advance i past the alef
        while (i + 1 < chars.length && isTashkeel(chars[i + 1])) {
          out.push(chars[i + 1]);
          i++;
        }
        i++; // skip the alef character itself
        continue;
      }
    }

    const prev = getPrevChar(i);
    const next = getNextChar(i);

    const prevConnects = prev && ARABIC_MAP[prev] && ARABIC_MAP[prev][4];
    const nextConnects = next && ARABIC_MAP[next];

    if (prevConnects && nextConnects && map[4]) {
      out.push(map[2]); // Medial form
    } else if (prevConnects) {
      out.push(map[3]); // Final form
    } else if (nextConnects && map[4]) {
      out.push(map[1]); // Initial form
    } else {
      out.push(map[0]); // Isolated form
    }
  }

  return out.join('');
}

export default reshapeArabic;

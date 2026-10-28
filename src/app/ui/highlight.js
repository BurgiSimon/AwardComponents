// A small syntax highlighter for the Code tab (JavaScript and CSS). Enough to read by, no dependency.
import { escapeHTML } from '../dom.js';

const JS_KEYWORDS = new Set('import export from default const let var function return if else for while of in new class extends async await try catch finally throw switch case break continue typeof instanceof this null undefined true false'.split(' '));

export function highlight(code, lang) {
  const rules = lang === 'css'
    ? [
        ['comment', /\/\*[\s\S]*?\*\//y],
        ['string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
        ['at', /@[\w-]+/y],
        ['prop', /--[\w-]+|[\w-]+(?=\s*:)/y],
        ['number', /-?\d*\.?\d+(?:px|rem|em|%|vh|vw|svh|dvh|s|ms|deg|fr)?/y],
        ['punct', /[{}();:,]/y],
        ['word', /[\w-]+|./y],
      ]
    : [
        ['comment', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
        ['string', /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
        ['number', /\b\d*\.?\d+(?:e[+-]?\d+)?\b/y],
        ['word', /[A-Za-z_$][\w$]*/y],
        ['punct', /[{}()[\];,.<>=+\-*/%!&|?:]/y],
        ['other', /\s+|./y],
      ];
  let out = '';
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const [kind, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || !m[0]) continue;
      let k = kind;
      if (kind === 'word' && lang !== 'css') {
        if (JS_KEYWORDS.has(m[0])) k = 'keyword';
        else if (code[re.lastIndex] === '(') k = 'fn';
        else k = '';
      } else if (kind === 'word' || kind === 'other') k = '';
      out += k ? `<span class="tk tk--${k}">${escapeHTML(m[0])}</span>` : escapeHTML(m[0]);
      i = re.lastIndex;
      matched = true;
      break;
    }
    if (!matched) { out += escapeHTML(code[i]); i++; }
  }
  return out;
}

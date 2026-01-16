// components/MarkdownMathRenderer.js
// Complete Markdown + Math Renderer following AST hierarchy:
// 1. Block-level parsing (headers, lists, blockquotes, code blocks, paragraphs)
// 2. Inline parsing (math delimiters first, then emphasis/code/links)
// 3. Math domain (LaTeX commands, symbols, scripts)

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ============================================================================
// CONSTANTS: Symbol and Greek Letter Maps
// ============================================================================

const GREEK_LETTERS = {
  // Lowercase
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
  phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  varepsilon: 'ε', vartheta: 'ϑ', varpi: 'ϖ', varrho: 'ϱ',
  varsigma: 'ς', varphi: 'ϕ',
  // Uppercase
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const MATH_SYMBOLS = {
  // Operators
  '\\cdot': '·', '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
  '\\ast': '∗', '\\star': '⋆', '\\circ': '∘', '\\bullet': '•',
  // Relations
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\equiv': '≡', '\\sim': '∼', '\\simeq': '≃', '\\cong': '≅',
  '\\propto': '∝', '\\ll': '≪', '\\gg': '≫',
  '\\prec': '≺', '\\succ': '≻', '\\preceq': '⪯', '\\succeq': '⪰',
  // Set Theory
  '\\in': '∈', '\\notin': '∉', '\\ni': '∋', '\\subset': '⊂',
  '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
  '\\cup': '∪', '\\cap': '∩', '\\setminus': '∖',
  '\\emptyset': '∅', '\\varnothing': '∅',
  // Arrows
  '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←',
  '\\leftrightarrow': '↔', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔', '\\implies': '⇒', '\\iff': '⇔',
  '\\mapsto': '↦', '\\uparrow': '↑', '\\downarrow': '↓',
  '\\nearrow': '↗', '\\searrow': '↘', '\\nwarrow': '↖', '\\swarrow': '↙',
  // Calculus & Analysis
  '\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮',
  '\\sum': '∑', '\\prod': '∏', '\\coprod': '∐',
  '\\partial': '∂', '\\nabla': '∇', '\\infty': '∞',
  '\\lim': 'lim', '\\limsup': 'lim sup', '\\liminf': 'lim inf',
  // Logic
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
  '\\land': '∧', '\\lor': '∨', '\\lnot': '¬', '\\neg': '¬',
  '\\wedge': '∧', '\\vee': '∨',
  // Misc
  '\\sqrt': '√', '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
  '\\triangle': '△', '\\square': '□', '\\diamond': '◇',
  '\\prime': '′', '\\dprime': '″',
  '\\hbar': 'ℏ', '\\ell': 'ℓ', '\\Re': 'ℜ', '\\Im': 'ℑ',
  '\\aleph': 'ℵ',
  // Dots
  '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
  '\\dots': '…',
  // Spacing (convert to actual spaces)
  '\\,': '\u2009', '\\:': '\u2005', '\\;': '\u2004', '\\quad': '\u2003',
  '\\qquad': '\u2003\u2003', '\\!': '',
  // Brackets
  '\\langle': '⟨', '\\rangle': '⟩',
  '\\lfloor': '⌊', '\\rfloor': '⌋',
  '\\lceil': '⌈', '\\rceil': '⌉',
  '\\{': '{', '\\}': '}',
  '\\|': '‖',
  // Text commands
  '\\text': '', '\\textrm': '', '\\textbf': '', '\\textit': '',
  '\\mathrm': '', '\\mathbf': '', '\\mathit': '', '\\mathbb': '',
  '\\mathcal': '', '\\mathfrak': '', '\\mathsf': '',
  // Functions (display as text)
  '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
  '\\sec': 'sec', '\\csc': 'csc', '\\cot': 'cot',
  '\\arcsin': 'arcsin', '\\arccos': 'arccos', '\\arctan': 'arctan',
  '\\sinh': 'sinh', '\\cosh': 'cosh', '\\tanh': 'tanh',
  '\\log': 'log', '\\ln': 'ln', '\\exp': 'exp',
  '\\min': 'min', '\\max': 'max', '\\arg': 'arg',
  '\\det': 'det', '\\dim': 'dim', '\\ker': 'ker',
  '\\gcd': 'gcd', '\\lcm': 'lcm', '\\mod': 'mod',
  // Remove these commands entirely
  '\\left': '', '\\right': '', '\\big': '', '\\Big': '',
  '\\bigg': '', '\\Bigg': '',
};

// Superscript/subscript digit maps
const SUPERSCRIPT_MAP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ',
  'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ',
  's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ',
};

const SUBSCRIPT_MAP = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

// ============================================================================
// MATH PROCESSING
// ============================================================================

/**
 * Convert a string to superscript Unicode characters where possible
 */
const toSuperscript = (str) => {
  let result = '';
  for (const char of str) {
    result += SUPERSCRIPT_MAP[char] || char;
  }
  return result;
};

/**
 * Convert a string to subscript Unicode characters where possible
 */
const toSubscript = (str) => {
  let result = '';
  for (const char of str) {
    result += SUBSCRIPT_MAP[char] || char;
  }
  return result;
};

/**
 * Extract content from braces: {content} -> content
 */
const extractBraces = (str, startIndex) => {
  if (str[startIndex] !== '{') return { content: '', endIndex: startIndex };

  let depth = 1;
  let i = startIndex + 1;
  let content = '';

  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') depth--;

    if (depth > 0) content += str[i];
    i++;
  }

  return { content, endIndex: i };
};

/**
 * Process LaTeX math content into readable Unicode text
 */
const processMathContent = (latex) => {
  if (!latex || typeof latex !== 'string') return '';

  let result = latex;

  // 1. Handle \frac{num}{den} -> num/den
  result = result.replace(/\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    (_, num, den) => `(${processMathContent(num)})/(${processMathContent(den)})`);

  // 2. Handle \sqrt[n]{x} and \sqrt{x}
  result = result.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    (_, n, x) => `${toSuperscript(n)}√(${processMathContent(x)})`);
  result = result.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    (_, x) => `√(${processMathContent(x)})`);

  // 3. Handle subscripts and superscripts with braces: x^{2} or x_{n}
  result = result.replace(/\^(\{[^{}]*\})/g, (_, braced) => {
    const content = braced.slice(1, -1);
    return toSuperscript(processMathContent(content));
  });
  result = result.replace(/_(\{[^{}]*\})/g, (_, braced) => {
    const content = braced.slice(1, -1);
    return toSubscript(processMathContent(content));
  });

  // 4. Handle single-char subscripts and superscripts: x^2 or x_n
  result = result.replace(/\^([a-zA-Z0-9])/g, (_, char) => toSuperscript(char));
  result = result.replace(/_([a-zA-Z0-9])/g, (_, char) => toSubscript(char));

  // 5. Replace all Greek letters
  Object.entries(GREEK_LETTERS).forEach(([name, symbol]) => {
    // Match \alpha but not \alphanumeric
    const regex = new RegExp(`\\\\${name}(?![a-zA-Z])`, 'g');
    result = result.replace(regex, symbol);
  });

  // 6. Replace all math symbols (sorted by length to match longer ones first)
  const sortedSymbols = Object.entries(MATH_SYMBOLS)
    .sort((a, b) => b[0].length - a[0].length);

  sortedSymbols.forEach(([cmd, symbol]) => {
    // Escape special regex chars in the command
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, symbol);
  });

  // 7. Handle remaining \command{content} patterns - just show content
  result = result.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, '$1');

  // 8. Clean up remaining backslashes (unknown commands)
  result = result.replace(/\\[a-zA-Z]+/g, '');
  result = result.replace(/\\/g, '');

  // 9. Clean up extra spaces
  result = result.replace(/\s+/g, ' ').trim();

  return result;
};

// ============================================================================
// INLINE TOKENIZER
// ============================================================================

/**
 * Tokenize inline content, identifying math regions first, then markdown
 */
const tokenizeInline = (text) => {
  if (!text) return [];

  const tokens = [];

  // Regex to find math delimiters: $$...$$, \[...\], $...$, \(...\)
  // Order matters: check longer delimiters first
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?!\$)(?:[^$\\]|\\.)+?\$|\\\((?:[^\\]|\\.)*?\\\))/g;

  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    const raw = match[0];
    let mathContent = '';
    let isBlock = false;

    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      mathContent = raw.slice(2, -2);
      isBlock = true;
    } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
      mathContent = raw.slice(2, -2);
      isBlock = true;
    } else if (raw.startsWith('$') && raw.endsWith('$')) {
      mathContent = raw.slice(1, -1);
      isBlock = false;
    } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
      mathContent = raw.slice(2, -2);
      isBlock = false;
    }

    tokens.push({
      type: isBlock ? 'block_math' : 'inline_math',
      content: mathContent.trim(),
      processed: processMathContent(mathContent.trim())
    });

    lastIndex = mathRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return tokens;
};

/**
 * Parse markdown emphasis within text tokens
 * Handles: **bold**, *italic*, ***bold italic***, `code`, ~~strikethrough~~
 */
const parseMarkdownEmphasis = (text, colors, keyPrefix) => {
  if (!text) return null;

  // Pattern to match: ***...*** | **...** | *...* | `...` | ~~...~~
  const emphasisRegex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = emphasisRegex.exec(text)) !== null) {
    // Add plain text before
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];

    if (raw.startsWith('***') && raw.endsWith('***')) {
      // Bold Italic
      parts.push(
        <Text key={`${keyPrefix}-bi-${match.index}`} style={{ fontWeight: '700', fontStyle: 'italic', color: colors.text }}>
          {raw.slice(3, -3)}
        </Text>
      );
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      // Bold
      parts.push(
        <Text key={`${keyPrefix}-b-${match.index}`} style={{ fontWeight: '700', color: colors.text }}>
          {raw.slice(2, -2)}
        </Text>
      );
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      // Italic
      parts.push(
        <Text key={`${keyPrefix}-i-${match.index}`} style={{ fontStyle: 'italic', color: colors.text }}>
          {raw.slice(1, -1)}
        </Text>
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      // Inline code
      parts.push(
        <Text key={`${keyPrefix}-c-${match.index}`} style={[styles.inlineCode, { backgroundColor: colors.tint, color: colors.text }]}>
          {raw.slice(1, -1)}
        </Text>
      );
    } else if (raw.startsWith('~~') && raw.endsWith('~~')) {
      // Strikethrough
      parts.push(
        <Text key={`${keyPrefix}-s-${match.index}`} style={{ textDecorationLine: 'line-through', color: colors.textSecondary }}>
          {raw.slice(2, -2)}
        </Text>
      );
    }

    lastIndex = emphasisRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

/**
 * Render inline tokens (math + text with emphasis)
 */
const renderInlineTokens = (tokens, colors, keyPrefix = 'inline') => {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;

    if (token.type === 'inline_math') {
      return (
        <Text key={key} style={[styles.inlineMath, { color: colors.text }]}>
          {token.processed}
        </Text>
      );
    }

    if (token.type === 'block_math') {
      return (
        <Text key={key} style={[styles.blockMath, { color: colors.text }]}>
          {token.processed}
        </Text>
      );
    }

    // Regular text - apply markdown emphasis
    return (
      <Text key={key}>
        {parseMarkdownEmphasis(token.content, colors, key)}
      </Text>
    );
  });
};

/**
 * Parse and render a single line of content
 */
const renderLine = (line, colors, key) => {
  const tokens = tokenizeInline(line);
  return renderInlineTokens(tokens, colors, `line-${key}`);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MarkdownMathRenderer({ content, style, inline = false }) {
  const { colors } = useTheme();

  if (!content) return null;

  // Inline mode: render as single Text element
  if (inline) {
    const tokens = tokenizeInline(content);
    return (
      <Text style={[styles.text, { color: colors.textSecondary }, style]}>
        {renderInlineTokens(tokens, colors, 'inline')}
      </Text>
    );
  }

  // Block mode: parse line by line
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <View key={`code-${i}`} style={[styles.codeBlock, { backgroundColor: colors.tint }]}>
            <Text style={[styles.codeText, { color: colors.text }]}>
              {codeBlockContent.join('\n')}
            </Text>
          </View>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<View key={`empty-${i}`} style={{ height: 8 }} />);
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(
        <View key={`hr-${i}`} style={[styles.hr, { backgroundColor: colors.border }]} />
      );
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerContent = headerMatch[2];
      const headerStyles = [
        styles.h1, styles.h2, styles.h3,
        styles.h4, styles.h5, styles.h6
      ];
      elements.push(
        <Text key={`h-${i}`} style={[headerStyles[level - 1] || styles.h3, { color: colors.text }]}>
          {renderLine(headerContent, colors, i)}
        </Text>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <View key={`quote-${i}`} style={[styles.blockquote, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {renderLine(trimmed.slice(2), colors, i)}
          </Text>
        </View>
      );
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <View key={`num-${i}`} style={styles.listRow}>
          <Text style={[styles.listNumber, { color: colors.primary }]}>{numberedMatch[1]}.</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {renderLine(numberedMatch[2], colors, i)}
            </Text>
          </View>
        </View>
      );
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <View key={`bullet-${i}`} style={styles.listRow}>
          <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {renderLine(trimmed.slice(2), colors, i)}
            </Text>
          </View>
        </View>
      );
      continue;
    }

    // Task list
    const taskMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      elements.push(
        <View key={`task-${i}`} style={styles.listRow}>
          <Text style={[styles.bullet, { color: colors.primary }]}>
            {checked ? '☑' : '☐'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {renderLine(taskMatch[2], colors, i)}
            </Text>
          </View>
        </View>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={`p-${i}`} style={[styles.text, { color: colors.textSecondary }, style]}>
        {renderLine(trimmed, colors, i)}
      </Text>
    );
  }

  return <View style={styles.container}>{elements}</View>;
}

/**
 * Simplified inline-only component
 */
export function MathText({ children, style }) {
  const { colors } = useTheme();

  if (!children) return null;

  const tokens = tokenizeInline(children);

  return (
    <Text style={[styles.text, { color: colors.textSecondary }, style]}>
      {renderInlineTokens(tokens, colors, 'mathtext')}
    </Text>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_500Medium',
  },
  inlineMath: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 15,
  },
  blockMath: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
    lineHeight: 28,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlock: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  h1: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    marginTop: 20,
    marginBottom: 8,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginTop: 18,
    marginBottom: 6,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 14,
    marginBottom: 4,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 4,
  },
  h5: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 2,
  },
  h6: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 16,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
    marginTop: 2,
  },
  listNumber: {
    fontSize: 16,
    fontWeight: '600',
    width: 28,
    marginTop: 2,
  },
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: 16,
    marginLeft: 4,
    paddingVertical: 4,
    marginVertical: 4,
  },
  hr: {
    height: 1,
    marginVertical: 16,
  },
});

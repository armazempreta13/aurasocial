import React from 'react';
import Link from 'next/link';

/**
 * Parses inline markdown: ***bold-italic***, **bold**, *italic*, and wraps the result in
 * React elements. Returns an array of React nodes.
 */
function parseInlineMarkdown(text: string, linkClassName: string, baseMentionUrl: string, baseHashtagUrl: string): React.ReactNode[] {
  // Regex order matters: check for 3 asterisks, then 2, then 1.
  // We use .+? to ensure there's content between asterisks, avoiding literal **** display.
  const regex = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*)/g;
  const parts = text.split(regex);
  const nodes: React.ReactNode[] = [];
  let key = 0;

  parts.forEach((part) => {
    if (part.startsWith('***') && part.endsWith('***')) {
      const inner = part.slice(3, -3);
      nodes.push(
        <strong key={key++} className="font-extrabold italic">
          {parseInlineMarkdown(inner, linkClassName, baseMentionUrl, baseHashtagUrl)}
        </strong>
      );
    } else if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      nodes.push(
        <strong key={key++} className="font-extrabold">
          {parseInlineMarkdown(inner, linkClassName, baseMentionUrl, baseHashtagUrl)}
        </strong>
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      const inner = part.slice(1, -1);
      nodes.push(
        <em key={key++} className="italic not-italic-none">
          {parseInlineMarkdown(inner, linkClassName, baseMentionUrl, baseHashtagUrl)}
        </em>
      );
    } else {
      // Plain text part: now handle mentions and hashtags
      const subParts = part.split(/([@#][\w\u00C0-\u00FF]+)/g);
      subParts.forEach((subPart) => {
        if (subPart.startsWith('@') && subPart.length > 1) {
          nodes.push(
            <Link key={key++} href={`${baseMentionUrl}${subPart.slice(1)}`} className={linkClassName} onClick={e => e.stopPropagation()}>
              {subPart}
            </Link>
          );
        } else if (subPart.startsWith('#') && subPart.length > 1) {
          nodes.push(
            <Link key={key++} href={`${baseHashtagUrl}${encodeURIComponent(subPart)}`} className={linkClassName} onClick={e => e.stopPropagation()}>
              {subPart}
            </Link>
          );
        } else if (subPart) {
          nodes.push(subPart);
        }
      });
    }
  });

  return nodes;
}

/**
 * Transforms text containing @username, #hashtag, **bold**, *italic*,
 * and > blockquote lines into React elements with links and formatting.
 */
export function renderTextWithLinks(text: string, options: { 
  baseMentionUrl?: string; 
  baseHashtagUrl?: string;
  className?: string;
  linkClassName?: string;
} = {}) {
  if (!text) return null;

  const {
    baseMentionUrl = '/@',
    baseHashtagUrl = '/explore?q=',
    linkClassName = 'text-primary font-bold hover:underline'
  } = options;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const isQuote = line.startsWith('> ');
    const lineContent = isQuote ? line.slice(2) : line;
    const parsed = parseInlineMarkdown(lineContent, linkClassName, baseMentionUrl, baseHashtagUrl);

    if (isQuote) {
      elements.push(
        <span
          key={`line-${lineIdx}`}
          className="block border-l-4 border-primary/30 bg-primary/5 pl-3 py-1 rounded-sm text-slate-700 my-1.5"
        >
          {parsed}
        </span>
      );
    } else {
      elements.push(
        <span key={`line-${lineIdx}`} className="block min-h-[1.2em]">
          {parsed}
        </span>
      );
    }
  });

  return <>{elements}</>;
}



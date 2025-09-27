import React from 'react';

/**
 * Parse text content to render HTML links as React elements
 *
 * @param text - The text content that may contain HTML anchor tags
 * @returns Array of React elements representing the parsed text with links
 */
export const parseTextWithLinks = (text: string): React.ReactElement[] => {
  const linkRegex = /<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const parts: React.ReactElement[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    // Add the link
    const href = match[1];
    const linkText = match[2];
    parts.push(
      <a
        key={`link-${match.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="assistant-link"
      >
        {linkText}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last link
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key="text">{text}</span>];
};

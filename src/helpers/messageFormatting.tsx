import React from 'react';
import { parseTextWithLinks } from './textParsing';

/**
 * Auto-format a message with proper styling for different content types
 *
 * @param text - The message text to format
 * @returns Array of React elements representing the formatted message
 */
export const formatMessage = (text: string): React.ReactElement[] => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const trimmedLine = line.trim();

    // Calculate indentation level based on leading whitespace
    const indentLevel = line.search(/\S/);
    const indentStyle =
      indentLevel > 0 ? { marginLeft: `${indentLevel * 0.5}em` } : {};

    // Handle hyphen lists
    if (trimmedLine.startsWith('- ')) {
      const content = trimmedLine.substring(2);

      // Check if the content starts with a colon sentence
      if (content.endsWith(':') && content.split(' ').length <= 15) {
        return (
          <div key={index} className="assistant-list-item" style={indentStyle}>
            <span className="list-bullet">•</span>
            <span className="list-content-header">
              {parseTextWithLinks(content)}
            </span>
          </div>
        );
      }
      return (
        <div key={index} className="assistant-list-item" style={indentStyle}>
          <span className="list-bullet">•</span>
          <span className="list-content">{parseTextWithLinks(content)}</span>
        </div>
      );
    }

    // Handle numbered lists
    if (/^\d+\.\s/.test(trimmedLine)) {
      const match = trimmedLine.match(/^(\d+)\.\s(.+)/);
      if (match) {
        return (
          <div key={index} className="assistant-list-item" style={indentStyle}>
            <span className="list-number">{match[1]}.</span>
            <span className="list-content">{parseTextWithLinks(match[2])}</span>
          </div>
        );
      }
    }

    // Handle code blocks (lines starting with 4+ spaces or tabs)
    if (/^(\s{4,}|\t)/.test(line)) {
      return (
        <div key={index} className="assistant-code-line" style={indentStyle}>
          {line}
        </div>
      );
    }

    // Handle empty lines
    if (trimmedLine === '') {
      return <div key={index} className="assistant-empty-line" />;
    }

    // Handle header formatting - single line sentences ending with colon
    if (
      trimmedLine.endsWith(':') &&
      !trimmedLine.includes('\n') &&
      trimmedLine.split(' ').length <= 15
    ) {
      return (
        <div key={index} className="assistant-header-line" style={indentStyle}>
          <strong>{parseTextWithLinks(trimmedLine)}</strong>
        </div>
      );
    }

    // Handle regular text with proper indentation
    return (
      <div key={index} className="assistant-text-line" style={indentStyle}>
        {parseTextWithLinks(trimmedLine)}
      </div>
    );
  });
};

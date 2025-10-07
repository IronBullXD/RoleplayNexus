import React from 'react';

// A recursive function to parse simple markdown for bold, italic, and strikethrough.
const parseInlineMarkdown = (text: string): React.ReactNode[] => {
  // Regex for bold, strikethrough, and italic. Order matters for correct parsing.
  // We match the longest patterns first (e.g., ** before *).
  const markdownRegex = /(\*\*.*?\*\*|__.*?__|~~.*?~~|\*.*?\*|_.*?_)/;

  if (!text) {
    return [];
  }

  // Split the string by the markdown delimiters. The capturing group in the regex
  // ensures that the delimiters are also included in the resulting array.
  const parts = text.split(markdownRegex);
  
  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{parseInlineMarkdown(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={index}>{parseInlineMarkdown(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <s key={index}>{parseInlineMarkdown(part.slice(2, -2))}</s>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      // This handles what was previously "actions" and is now standard italic.
      return <em key={index} className="italic text-slate-400">{parseInlineMarkdown(part.slice(1, -1))}</em>;
    }
    if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={index} className="italic text-slate-400">{parseInlineMarkdown(part.slice(1, -1))}</em>;
    }

    return part; // Plain text
  }).filter(Boolean);
};

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  // A simple fix to remove a common AI artifact where a response starts with a single dot on a new line.
  const processedText = text.replace(/^\s*\.\n/, '');

  // Split text into lines to handle OOC messages, which are line-based.
  const lines = processedText.split('\n');

  return (
    <>
      {lines.map((line, lineIndex) => {
        // Trim to correctly detect OOC messages that might have leading whitespace.
        const isOoc = line.trim().startsWith('//') || line.trim().startsWith('(OOC:');
        
        if (isOoc) {
          return (
            <React.Fragment key={lineIndex}>
              {/* Render the original line to preserve whitespace and add newline */}
              <span className="italic text-slate-500">{line}</span>
              {lineIndex < lines.length - 1 && '\n'}
            </React.Fragment>
          );
        }

        // For regular lines, parse for other markdown.
        return (
          <React.Fragment key={lineIndex}>
            {parseInlineMarkdown(line)}
            {lineIndex < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default SimpleMarkdown;
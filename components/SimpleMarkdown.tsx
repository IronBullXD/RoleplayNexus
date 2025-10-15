import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { World, WorldEntry } from '../types';
import { Tooltip } from './Tooltip';
import { useAppStore } from '../store/useAppStore';

// Utility to escape strings for regex
const escapeRegex = (str: string) =>
  str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

// A map to cache compiled regexes and keyword maps for worlds
const worldCache = new Map<
  string,
  { regex: RegExp; map: Map<string, WorldEntry> } | null
>();

const getCachedWorldData = (world: World) => {
  if (worldCache.has(world.id)) {
    return worldCache.get(world.id);
  }

  const keywordMap = new Map<string, WorldEntry>();
  const allKeywords: string[] = [];

  (world.entries || []).forEach((entry) => {
    if (entry.enabled && entry.keys) {
      entry.keys.forEach((key) => {
        const trimmedKey = key.trim();
        if (trimmedKey.length > 1) {
          // Ignore very short keys
          keywordMap.set(trimmedKey.toLowerCase(), entry);
          allKeywords.push(escapeRegex(trimmedKey));
        }
      });
    }
  });

  if (allKeywords.length === 0) {
    // Cache null result to avoid re-computation for worlds without keywords
    worldCache.set(world.id, null);
    return null;
  }

  // Sort keywords by length descending to match longer phrases first
  allKeywords.sort((a, b) => b.length - a.length);

  const keywordPart = `(\\b(?:${allKeywords.join('|')})\\b)`;
  const combinedRegex = new RegExp(keywordPart, 'gi');

  const data = { regex: combinedRegex, map: keywordMap };
  worldCache.set(world.id, data);
  return data;
};

// This function takes a plain text string and intersperses it with Tooltip components for keywords
const tokenizeKeywords = (
  text: string,
  world: World,
  onEntryView: (worldId: string, entryId: string) => void,
): React.ReactNode[] => {
  const worldData = getCachedWorldData(world);
  if (!worldData) {
    return [text];
  }

  const { regex, map: keywordMap } = worldData;

  const parts = text.split(regex);
  const result: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      // Even-indexed parts are plain text
      if (part) result.push(part);
    } else {
      // Odd-indexed parts are the keywords
      const keyword = part;
      const entry = keywordMap.get(keyword.toLowerCase());
      if (entry) {
        const onShowCallback = () => onEntryView(world.id, entry.id);
        result.push(
          <Tooltip
            key={`${keyword}-${index}`}
            onShow={onShowCallback}
            content={
              <div className="p-1 max-w-xs text-left">
                <h4 className="font-bold border-b border-slate-600 pb-1 mb-1 text-slate-100">
                  {entry.name || 'Lore Entry'}
                </h4>
                <p className="text-xs whitespace-pre-wrap text-slate-300 custom-scrollbar max-h-48 overflow-y-auto">
                  {entry.content}
                </p>
              </div>
            }
            position="top"
          >
            <span className="text-crimson-300 border-b border-dotted border-crimson-500/70 cursor-pointer">
              {keyword}
            </span>
          </Tooltip>,
        );
      } else {
        result.push(keyword);
      }
    }
  });

  return result;
};

const SimpleMarkdown: React.FC<{ text: string; world?: World | null }> = ({
  text,
  world,
}) => {
  const { logWorldEntryInteraction } = useAppStore();

  const handleEntryView = useCallback(
    (worldId: string, entryId: string) => {
      logWorldEntryInteraction(worldId, entryId);
    },
    [logWorldEntryInteraction],
  );

  const customRenderers = useMemo(
    () => ({
      // We override the 'p' component because it's the most common block-level element.
      p: ({ children }: { children: React.ReactNode }) => {
        // Map over the children. If a child is a raw string, process it for keywords.
        // If it's already an element (like <strong>), render it as is.
        const processedChildren = React.Children.map(children, (child) => {
          if (typeof child === 'string' && world) {
            const tokens = tokenizeKeywords(child, world, handleEntryView);
            return tokens.map((token, i) => (
              <React.Fragment key={i}>{token}</React.Fragment>
            ));
          }
          return child;
        });
        // Avoid rendering a <p> tag to prevent extra spacing for each line
        return <>{processedChildren}</>;
      },
      // Keep em styling consistent with the old parser
      em: ({ children }: { children: React.ReactNode }) => (
        <em className="italic text-slate-400">{children}</em>
      ),
    }),
    [world, handleEntryView],
  );

  const content = useMemo(() => {
    const processedText = text.replace(/^\s*\.\n/, '');
    const lines = processedText.split('\n');

    return lines.map((line, lineIndex) => {
      const isOoc =
        line.trim().startsWith('//') || line.trim().startsWith('(OOC:');

      if (isOoc) {
        return (
          <React.Fragment key={lineIndex}>
            <span className="italic text-slate-500">{line}</span>
            {lineIndex < lines.length - 1 ? '\n' : ''}
          </React.Fragment>
        );
      }

      // Each non-OOC line gets its own ReactMarkdown instance to preserve line breaks
      return (
        <React.Fragment key={lineIndex}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={customRenderers}>
            {line}
          </ReactMarkdown>
          {lineIndex < lines.length - 1 ? '\n' : ''}
        </React.Fragment>
      );
    });
  }, [text, customRenderers]);

  return <>{content}</>;
};

export default React.memo(SimpleMarkdown);

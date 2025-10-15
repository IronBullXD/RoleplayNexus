import React, { useMemo, useCallback } from 'react';
import { World, WorldEntry } from '../types';
import { Tooltip } from './Tooltip';
import { useAppStore } from '../store/useAppStore';

// Utility to escape strings for regex
const escapeRegex = (str: string) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

// A map to cache compiled regexes and keyword maps for worlds
const worldCache = new Map<string, { regex: RegExp, map: Map<string, WorldEntry> } | null>();

const getCachedWorldData = (world: World) => {
    if (worldCache.has(world.id)) {
        return worldCache.get(world.id);
    }

    const keywordMap = new Map<string, WorldEntry>();
    const allKeywords: string[] = [];

    (world.entries || []).forEach(entry => {
        if (entry.enabled && entry.keys) {
            entry.keys.forEach(key => {
                const trimmedKey = key.trim();
                if (trimmedKey.length > 1) { // Ignore very short keys
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

    const markdownPart = '(\\*\\*.*?\\*\\*|__.*?__|~~.*?~~|\\*.*?\\*|_.*?)';
    const keywordPart = `(\\b(?:${allKeywords.join('|')})\\b)`;
    const combinedRegex = new RegExp(`${markdownPart}|${keywordPart}`, 'gi');
    
    const data = { regex: combinedRegex, map: keywordMap };
    worldCache.set(world.id, data);
    return data;
};

const parseRichText = (text: string, world: World | null | undefined, onEntryView?: (worldId: string, entryId: string) => void): React.ReactNode[] => {
    if (!text) return [];

    const worldData = world ? getCachedWorldData(world) : null;
    
    // Fallback for simple markdown if no world or no keywords
    if (!worldData) {
        const markdownRegex = /(\*\*.*?\*\*|__.*?__|~~.*?~~|\*.*?\*|_.*?_)/g;
        const result: React.ReactNode[] = [];
        let lastIndex = 0;
        const matches = [...text.matchAll(markdownRegex)];

        for (const match of matches) {
            const [fullMatch] = match;
            const matchIndex = match.index || 0;

            if (matchIndex > lastIndex) {
                result.push(text.substring(lastIndex, matchIndex));
            }

            if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) result.push(<strong key={`match-${matchIndex}`}>{parseRichText(fullMatch.slice(2, -2), world, onEntryView)}</strong>);
            else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) result.push(<strong key={`match-${matchIndex}`}>{parseRichText(fullMatch.slice(2, -2), world, onEntryView)}</strong>);
            else if (fullMatch.startsWith('~~') && fullMatch.endsWith('~~')) result.push(<s key={`match-${matchIndex}`}>{parseRichText(fullMatch.slice(2, -2), world, onEntryView)}</s>);
            else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) result.push(<em key={`match-${matchIndex}`} className="italic text-slate-400">{parseRichText(fullMatch.slice(1, -1), world, onEntryView)}</em>);
            else if (fullMatch.startsWith('_') && fullMatch.endsWith('_')) result.push(<em key={`match-${matchIndex}`} className="italic text-slate-400">{parseRichText(fullMatch.slice(1, -1), world, onEntryView)}</em>);
            else result.push(fullMatch);
            
            lastIndex = matchIndex + fullMatch.length;
        }

        if (lastIndex < text.length) {
            result.push(text.substring(lastIndex));
        }
        
        return result;
    }
    
    const { regex: combinedRegex, map: keywordMap } = worldData;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    const matches = [...text.matchAll(combinedRegex)];

    for (const match of matches) {
        const [fullMatch, markdownMatch, keywordMatch] = match;
        const matchIndex = match.index || 0;

        if (matchIndex > lastIndex) {
            result.push(text.substring(lastIndex, matchIndex));
        }

        if (markdownMatch) {
            if (markdownMatch.startsWith('**') && markdownMatch.endsWith('**')) result.push(<strong key={`match-${matchIndex}`}>{parseRichText(markdownMatch.slice(2, -2), world, onEntryView)}</strong>);
            else if (markdownMatch.startsWith('__') && markdownMatch.endsWith('__')) result.push(<strong key={`match-${matchIndex}`}>{parseRichText(markdownMatch.slice(2, -2), world, onEntryView)}</strong>);
            else if (markdownMatch.startsWith('~~') && markdownMatch.endsWith('~~')) result.push(<s key={`match-${matchIndex}`}>{parseRichText(markdownMatch.slice(2, -2), world, onEntryView)}</s>);
            else if (markdownMatch.startsWith('*') && markdownMatch.endsWith('*')) result.push(<em key={`match-${matchIndex}`} className="italic text-slate-400">{parseRichText(markdownMatch.slice(1, -1), world, onEntryView)}</em>);
            else if (markdownMatch.startsWith('_') && markdownMatch.endsWith('_')) result.push(<em key={`match-${matchIndex}`} className="italic text-slate-400">{parseRichText(markdownMatch.slice(1, -1), world, onEntryView)}</em>);
            else result.push(fullMatch);
        } else if (keywordMatch) {
            const entry = keywordMap.get(keywordMatch.toLowerCase());
            if (entry) {
                const onShowCallback = (world && onEntryView) ? () => onEntryView(world.id, entry.id) : undefined;
                result.push(
                    <Tooltip
                      key={`match-${matchIndex}`}
                      onShow={onShowCallback}
                      content={
                        <div className="p-1 max-w-xs text-left">
                          <h4 className="font-bold border-b border-slate-600 pb-1 mb-1 text-slate-100">{entry.name || 'Lore Entry'}</h4>
                          <p className="text-xs whitespace-pre-wrap text-slate-300 custom-scrollbar max-h-48 overflow-y-auto">{entry.content}</p>
                        </div>
                      }
                      position="top"
                    >
                      <span className="text-crimson-300 border-b border-dotted border-crimson-500/70 cursor-pointer">
                        {keywordMatch}
                      </span>
                    </Tooltip>
                );
            } else {
                result.push(keywordMatch);
            }
        }
        
        lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
        result.push(text.substring(lastIndex));
    }

    return result;
}

const SimpleMarkdown: React.FC<{ text: string; world?: World | null }> = ({ text, world }) => {
  const { logWorldEntryInteraction } = useAppStore();

  const handleEntryView = useCallback((worldId: string, entryId: string) => {
    logWorldEntryInteraction(worldId, entryId);
  }, [logWorldEntryInteraction]);

  const content = useMemo(() => {
    const processedText = text.replace(/^\s*\.\n/, '');
    const lines = processedText.split('\n');

    return lines.map((line, lineIndex) => {
        const isOoc = line.trim().startsWith('//') || line.trim().startsWith('(OOC:');

        if (isOoc) {
          return (
            <React.Fragment key={lineIndex}>
              <span className="italic text-slate-500">{line}</span>
              {lineIndex < lines.length - 1 && '\n'}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={lineIndex}>
            {parseRichText(line, world, handleEntryView)}
            {lineIndex < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      });
  }, [text, world, handleEntryView]);

  return <>{content}</>;
};

export default SimpleMarkdown;
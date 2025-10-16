import { World, WorldEntry, ValidationIssue, LLMProvider } from '../types';
import { checkForInconsistencies } from './llmService';
import { ERROR_MESSAGES } from './errorMessages';

const MIN_CONTENT_LENGTH = 50; // characters

export function validateWorld(world: World): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!world.entries || world.entries.length === 0) {
    return [];
  }

  const entries = world.entries;
  const entryMap = new Map<string, WorldEntry>(entries.map(e => [e.id, e]));

  // --- Check 1: Duplicate Keywords ---
  const keywordMap = new Map<string, string[]>(); // keyword -> entryId[]
  entries.forEach(entry => {
    (entry.keys || []).forEach(key => {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey) {
        if (!keywordMap.has(lowerKey)) keywordMap.set(lowerKey, []);
        keywordMap.get(lowerKey)!.push(entry.id);
      }
    });
  });

  keywordMap.forEach((entryIds, keyword) => {
    if (entryIds.length > 1) {
      const entryNames = entryIds.map(id => entryMap.get(id)?.name || 'Unnamed').join(', ');
      issues.push({
        type: 'DuplicateKeyword',
        severity: 'warning',
        message: `Keyword "${keyword}" is used in multiple entries: ${entryNames}. This can cause unpredictable lore injection.`,
        entryIds,
        relatedData: { keyword, otherEntryNames: entryNames.split(', ') }
      });
    }
  });

  // --- Check 2: Unused, Missing Name, Short Content, Formatting, Missing Keywords ---
  entries.forEach(entry => {
    // Unused Entry
    const hasKeys = entry.keys && entry.keys.some(k => k.trim().length > 0);
    if (!hasKeys && !entry.isAlwaysActive) {
      issues.push({
        type: 'UnusedEntry',
        severity: 'info',
        message: `Entry "${entry.name || 'Unnamed'}" has no keywords and is not "Always Active", so it may never be used.`,
        entryIds: [entry.id]
      });
    }

    // Missing Name
    if (!entry.name || entry.name.trim().length === 0) {
      issues.push({
        type: 'MissingName',
        severity: 'warning',
        message: 'This entry is missing a name, which can make it hard to manage.',
        entryIds: [entry.id]
      });
    }

    // Short Content
    if (!entry.content || entry.content.trim().length < MIN_CONTENT_LENGTH) {
      issues.push({
        type: 'ShortContent',
        severity: 'info',
        message: `Content for "${entry.name || 'Unnamed'}" is very short. It might be a placeholder.`,
        entryIds: [entry.id]
      });
    }

    // Inconsistent Formatting
    if (entry.content) {
      const asteriskCount = (entry.content.match(/\*/g) || []).length;
      if (asteriskCount > 0 && asteriskCount % 2 !== 0) {
        issues.push({
          type: 'InconsistentFormatting',
          severity: 'info',
          message: `Entry "${entry.name || 'Unnamed'}" may have unclosed asterisks for actions. Found ${asteriskCount} asterisks.`,
          entryIds: [entry.id]
        });
      }
      const quoteCount = (entry.content.match(/"/g) || []).length;
      if (quoteCount > 0 && quoteCount % 2 !== 0) {
        issues.push({
          type: 'InconsistentFormatting',
          severity: 'info',
          message: `Entry "${entry.name || 'Unnamed'}" may have unclosed quotes for dialogue. Found ${quoteCount} quotes.`,
          entryIds: [entry.id]
        });
      }
    }
    
    // Missing Keywords from mentions
    if (entry.content) {
      const lowerContent = entry.content.toLowerCase();
      entries.forEach(targetEntry => {
        if (entry.id === targetEntry.id || !targetEntry.name) return;
        const targetName = targetEntry.name.toLowerCase();
        if (lowerContent.includes(targetName)) {
          const hasKeyword = (targetEntry.keys || []).some(k => k.toLowerCase().trim() === targetName);
          if (!hasKeyword) {
            issues.push({
              type: 'MissingKeywords',
              severity: 'info',
              message: `Entry "${entry.name || 'Unnamed'}" mentions "${targetEntry.name}", but that entry doesn't have its own name as a keyword.`,
              entryIds: [entry.id, targetEntry.id]
            });
          }
        }
      });
    }
  });
  
  // --- Check 3: Overlapping Keywords ---
  const allKeywords = Array.from(keywordMap.keys()).sort((a,b) => a.length - b.length);
  for(let i = 0; i < allKeywords.length; i++) {
      for (let j = i + 1; j < allKeywords.length; j++) {
          const shorterKey = allKeywords[i];
          const longerKey = allKeywords[j];
          if (longerKey.includes(shorterKey)) {
              const shorterKeyEntryIds = keywordMap.get(shorterKey)!;
              const longerKeyEntryIds = keywordMap.get(longerKey)!;
              
              if (shorterKeyEntryIds.some(id => !longerKeyEntryIds.includes(id))) {
                 issues.push({
                    type: 'OverlappingKeyword',
                    severity: 'info',
                    message: `Keyword "${shorterKey}" is a substring of "${longerKey}". This might cause the wrong entry to be triggered. Consider making keywords more specific.`,
                    entryIds: [...new Set([...shorterKeyEntryIds, ...longerKeyEntryIds])],
                    relatedData: { keyword: shorterKey, otherKeyword: longerKey }
                });
              }
          }
      }
  }

  // --- Check 4: Duplicate Content ---
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const contentMap = new Map<string, string[]>(); // normalizedContent -> entryId[]
  
  entries.forEach(entry => {
    if (entry.content && entry.content.trim().length > MIN_CONTENT_LENGTH) {
        const normalized = normalize(entry.content);
        if (!contentMap.has(normalized)) contentMap.set(normalized, []);
        contentMap.get(normalized)!.push(entry.id);
    }
  });
  
  contentMap.forEach((entryIds) => {
    if (entryIds.length > 1) {
        const entryNames = entryIds.map(id => entryMap.get(id)?.name || 'Unnamed');
        issues.push({
            type: 'DuplicateContent',
            severity: 'warning',
            message: `Entries have identical content: ${entryNames.join(', ')}.`,
            entryIds: entryIds,
            relatedData: { duplicateOf: entryNames.join(', ') }
        });
    }
  });

  // --- Check 5: Orphaned Entries ---
  entries.forEach(entry => {
    if (entry.isAlwaysActive || !entry.keys || entry.keys.length === 0) return;

    const isReferenced = (entry.keys || []).some(key => {
        const otherContent = entries
            .filter(e => e.id !== entry.id)
            .map(e => e.content || '')
            .join('\n')
            .toLowerCase();
        return otherContent.includes(key.toLowerCase().trim());
    });

    if (!isReferenced) {
        issues.push({
            type: 'OrphanedEntry',
            severity: 'info',
            message: `Entry "${entry.name || 'Unnamed'}" has keywords but doesn't seem to be referenced from any other entry's content.`,
            entryIds: [entry.id]
        });
    }
  });

  // --- Check 6: Circular References ---
  const adj = new Map<string, string[]>();
  const allKeywordsByEntry = new Map<string, string[]>();
  entries.forEach(entry => {
      allKeywordsByEntry.set(entry.id, (entry.keys || []).map(k => k.toLowerCase().trim()).filter(Boolean));
  });

  entries.forEach(sourceEntry => {
    if (!sourceEntry.content) return;
    const lowerContent = sourceEntry.content.toLowerCase();
    const dependencies: string[] = [];
    entries.forEach(targetEntry => {
      if (sourceEntry.id === targetEntry.id) return;
      const targetKeywords = allKeywordsByEntry.get(targetEntry.id) || [];
      if (targetKeywords.some(key => lowerContent.includes(key))) {
        dependencies.push(targetEntry.id);
      }
    });
    adj.set(sourceEntry.id, dependencies);
  });
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles = new Set<string>();

  function detectCycle(nodeId: string, path: string[]) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const neighbors = adj.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (recursionStack.has(neighborId)) {
        const cycleStartIndex = path.indexOf(neighborId);
        const cyclePathIds = path.slice(cycleStartIndex);
        const cyclePathNames = [...cyclePathIds.map(id => entryMap.get(id)?.name || 'Unnamed'), entryMap.get(neighborId)?.name || 'Unnamed'];
        const sortedCyclePath = [...cyclePathIds].sort();
        const cycleKey = sortedCyclePath.join('->');
        
        if (!cycles.has(cycleKey)) {
            issues.push({
                type: 'CircularReference',
                severity: 'warning',
                message: `A circular reference was detected: ${cyclePathNames.join(' -> ')}.`,
                entryIds: cyclePathIds,
                relatedData: { path: cyclePathNames }
            });
            cycles.add(cycleKey);
        }
      } else if (!visited.has(neighborId)) {
        detectCycle(neighborId, [...path, neighborId]);
      }
    }
    recursionStack.delete(nodeId);
  }

  for (const entry of entries) {
    if (!visited.has(entry.id)) {
      detectCycle(entry.id, [entry.id]);
    }
  }

  return issues;
}


export async function runConsistencyCheck({
    world,
    provider,
    apiKey,
    model
}: {
    world: World,
    provider: LLMProvider,
    apiKey: string,
    model: string
}): Promise<ValidationIssue[]> {
    if (!world.entries || world.entries.filter(e => e.enabled).length < 2) {
        return [];
    }
    
    if (!model || !apiKey) {
        throw new Error(ERROR_MESSAGES.API_KEY_MISSING(provider));
    }

    const reports = await checkForInconsistencies({ world, provider, apiKey, model });
    
    return reports.map(report => ({
        type: 'Contradiction',
        severity: 'warning',
        message: report.explanation,
        entryIds: report.conflictingEntryIds,
    }));
}
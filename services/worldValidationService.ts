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

  // --- Check 2: Unused, Missing Name, Short Content ---
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
              
              // Only flag if they belong to different entries
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
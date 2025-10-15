import React from 'react';
import { motion } from 'framer-motion';
import { WorldEntry, WorldEntryCategory } from '../types';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface SuggestionsBarProps {
  suggestions: WorldEntry[];
  onSuggestionClick: (entry: WorldEntry) => void;
  onClose: () => void;
}

const categoryIcons: Record<WorldEntryCategory, string> = {
  [WorldEntryCategory.CHARACTER]: 'character',
  [WorldEntryCategory.LOCATION]: 'map-pin',
  [WorldEntryCategory.ITEM]: 'cube',
  [WorldEntryCategory.FACTION]: 'shield',
  [WorldEntryCategory.LORE]: 'book-open',
  [WorldEntryCategory.EVENT]: 'calendar',
  [WorldEntryCategory.WORLD]: 'globe',
};

const SuggestionsBar: React.FC<SuggestionsBarProps> = ({ suggestions, onSuggestionClick, onClose }) => {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="mb-2 bg-slate-900/80 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Icon name="lightbulb" className="w-4 h-4 text-ember-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Suggestions</h4>
        </div>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-white rounded-md">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {suggestions.map(entry => (
          <Tooltip key={entry.id} content={(entry.content || '').slice(0, 150) + '...'} position="top">
            <button
              onClick={() => onSuggestionClick(entry)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-slate-800 text-slate-200 rounded-full hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Icon name={categoryIcons[entry.category || WorldEntryCategory.LORE]} className="w-3.5 h-3.5 text-slate-400" />
              <span>{entry.name}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </motion.div>
  );
};

export default SuggestionsBar;

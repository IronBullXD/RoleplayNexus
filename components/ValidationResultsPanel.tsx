import React, { useMemo } from 'react';
import { ValidationIssue, WorldEntry, ValidationType, WorldCoherenceReport } from '../types';
import { Icon } from './Icon';
import { motion } from 'framer-motion';

interface ValidationResultsPanelProps {
  issues: ValidationIssue[];
  onClose: () => void;
  onSelectEntry: (entryId: string) => void;
  worldName: string;
  entries: WorldEntry[];
  coherenceReport?: WorldCoherenceReport | null;
}

const issueMetadata: Record<ValidationType, { icon: string; color: string; title: string }> = {
  DuplicateKeyword: { icon: 'alert-triangle', color: 'text-ember-400', title: 'Duplicate Keywords' },
  UnusedEntry: { icon: 'lightbulb', color: 'text-sky-400', title: 'Unused Entries' },
  MissingName: { icon: 'alert-triangle', color: 'text-ember-400', title: 'Missing Entry Names' },
  ShortContent: { icon: 'lightbulb', color: 'text-sky-400', title: 'Short Content' },
  OverlappingKeyword: { icon: 'lightbulb', color: 'text-sky-400', title: 'Overlapping Keywords' },
  Contradiction: { icon: 'brain', color: 'text-purple-400', title: 'AI-Detected Inconsistencies' },
  CircularReference: { icon: 'alert-triangle', color: 'text-ember-400', title: 'Circular References' },
  OrphanedEntry: { icon: 'lightbulb', color: 'text-sky-400', title: 'Orphaned Entries' },
  InconsistentFormatting: { icon: 'lightbulb', color: 'text-sky-400', title: 'Inconsistent Formatting' },
  MissingKeywords: { icon: 'alert-triangle', color: 'text-ember-400', title: 'Potentially Missing Keywords' },
  DuplicateContent: { icon: 'alert-triangle', color: 'text-ember-400', title: 'Duplicate Content' },
  InvalidEntry: { icon: 'bug', color: 'text-red-400', title: 'Invalid Entry Data' },
  InconsistentVoice: { icon: 'zap', color: 'text-purple-400', title: 'Inconsistent Voice/Tone' },
};

const CoherenceScoreRing: React.FC<{ score: number }> = ({ score }) => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    let colorClass = 'text-emerald-400';
    if (score < 75) colorClass = 'text-yellow-400';
    if (score < 50) colorClass = 'text-ember-400';
    if (score < 25) colorClass = 'text-red-500';

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                    className="text-slate-700"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                />
                <motion.circle
                    className={colorClass}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                    transform="rotate(-90 60 60)"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "circOut", delay: 0.2 }}
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-4xl font-bold ${colorClass}`}>
                {score}
            </div>
        </div>
    );
};

const ValidationResultsPanel: React.FC<ValidationResultsPanelProps> = ({ issues, onClose, onSelectEntry, worldName, entries, coherenceReport }) => {

  const entryNameMap = useMemo(() => 
    new Map(entries.map(e => [e.id, e.name || 'Unnamed Entry']))
  , [entries]);

  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = [];
    }
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<ValidationIssue['type'], ValidationIssue[]>);

  const issueTypes = Object.keys(groupedIssues) as ValidationIssue['type'][];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[60] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-results-title"
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="shield-check" className="w-6 h-6 text-crimson-400" />
            <h2 id="validation-results-title" className="text-xl font-bold font-display tracking-widest uppercase">
              Validation Report for "{worldName}"
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close validation report"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {issues.length === 0 && !coherenceReport ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
               <Icon name="shield-check" className="w-20 h-20 text-emerald-500" />
               <h3 className="text-2xl font-bold text-slate-200 font-display mt-4">No Issues Found!</h3>
               <p className="mt-2">This world's structure looks solid. Great job!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {coherenceReport && (
                <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold font-display tracking-wider text-purple-400">
                        <Icon name="brain" className="w-5 h-5" /> AI Coherence Analysis
                    </h3>
                    <div className="mt-3 bg-slate-800/50 rounded-lg p-4 flex gap-6">
                        <div className="shrink-0">
                            <CoherenceScoreRing score={coherenceReport.score} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <p className="text-sm italic text-slate-300">"{coherenceReport.summary}"</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <h4 className="font-semibold text-emerald-400 mb-1">Strengths:</h4>
                                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                                        {coherenceReport.positivePoints.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-ember-400 mb-1">Improvements:</h4>
                                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                                        {coherenceReport.improvementAreas.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {issues.length > 0 && <div>
                <p className="text-slate-400 mb-4">Found {issues.length} potential structural issue(s). These are suggestions to improve consistency and may not need to be fixed.</p>
                {issueTypes.map(type => (
                    <div key={type} className="mb-6">
                    <h3 className={`flex items-center gap-2 text-lg font-semibold font-display tracking-wider ${(issueMetadata[type] || {}).color || 'text-slate-100'}`}>
                        <Icon name={(issueMetadata[type] || {}).icon || 'bug'} className="w-5 h-5" />
                        {(issueMetadata[type] || {}).title || type} ({groupedIssues[type].length})
                    </h3>
                    <div className="mt-3 space-y-2 border-l-2 border-slate-700 pl-4">
                        {groupedIssues[type].map((issue, index) => (
                        <div key={index} className={`p-3 rounded-md ${issue.severity === 'error' ? 'bg-red-900/50' : 'bg-slate-800/50'}`}>
                            <p className={`text-sm ${issue.severity === 'error' ? 'text-red-300' : 'text-slate-300'}`}>{issue.message}</p>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {issue.entryIds.map(id => (
                                <button 
                                key={id}
                                onClick={() => onSelectEntry(id)}
                                className="px-2 py-1 text-xs font-semibold text-sky-300 bg-sky-900/50 rounded-md hover:bg-sky-800/50"
                                >
                                Go to: "{entryNameMap.get(id) || 'Unknown Entry'}"
                                </button>
                            ))}
                            </div>
                        </div>
                        ))}
                    </div>
                    </div>
                ))}
              </div>}
            </div>
          )}
        </main>
      </motion.div>
    </motion.div>
  );
};

export default ValidationResultsPanel;
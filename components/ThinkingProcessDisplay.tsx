import React from 'react';
import { motion } from 'framer-motion';
import { ThinkingStep } from '../types';
import { Icon } from './Icon';

interface ThinkingProcessDisplayProps {
  steps: ThinkingStep[];
}

const ThinkingProcessDisplay: React.FC<ThinkingProcessDisplayProps> = ({ steps }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-sm text-slate-400 font-semibold">
        <Icon name="brain" className="w-4 h-4 text-purple-400 animate-pulse" />
        <span>Thinking...</span>
      </div>
      {steps.map((step, index) => (
        <motion.details
          key={index}
          className="bg-slate-800/50 rounded-lg overflow-hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <summary className="px-3 py-2 text-sm font-semibold text-slate-300 cursor-pointer flex justify-between items-center list-none group">
            <span>{step.title}</span>
            <Icon name="chevron-down" className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-3 pb-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400 whitespace-pre-wrap">{step.content}</p>
          </div>
        </motion.details>
      ))}
    </div>
  );
};

export default ThinkingProcessDisplay;
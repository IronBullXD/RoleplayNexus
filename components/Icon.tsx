import React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Settings,
  Send,
  X,
  User,
  Download,
  Upload,
  MoreVertical,
  MoreHorizontal,
  ArrowLeft,
  History,
  RotateCw,
  Check,
  BookOpen,
  Sparkles,
  Play,
  Square,
  Brain,
  GitFork,
  Bug,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Sliders,
  Terminal,
  MapPin,
  Box,
  Shield,
  Calendar,
  MinusSquare,
  Search,
  Copy,
  Pin,
  Globe,
  AlertTriangle,
  LucideProps,
} from 'lucide-react';
import { Tooltip } from './Tooltip';

type LucideIconComponent = React.FC<LucideProps>;

const icons: { [key: string]: LucideIconComponent } = {
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  settings: Settings,
  send: Send,
  close: X,
  character: User,
  import: Download,
  export: Upload,
  'ellipsis-vertical': MoreVertical,
  'ellipsis-horizontal': MoreHorizontal,
  'arrow-left': ArrowLeft,
  history: History,
  redo: RotateCw,
  checkmark: Check,
  'book-open': BookOpen,
  sparkles: Sparkles,
  play: Play,
  stop: Square,
  brain: Brain,
  fork: GitFork,
  bug: Bug,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'new-chat': MessageSquarePlus,
  sliders: Sliders,
  terminal: Terminal,
  'map-pin': MapPin,
  cube: Box,
  shield: Shield,
  calendar: Calendar,
  'minus-square': MinusSquare,
  search: Search,
  duplicate: Copy,
  pin: Pin,
  globe: Globe,
  'alert-triangle': AlertTriangle,
};

interface IconProps extends LucideProps {
  name: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  className = 'h-5 w-5',
  ...props
}) => {
  const LucideIcon = icons[name];

  if (!LucideIcon) {
    // Return a fallback or null for unknown icon names
    return null;
  }

  return <LucideIcon className={className} strokeWidth={1.5} {...props} />;
};

export const IconButton: React.FC<{
  onClick?: () => void;
  icon: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}> = ({
  onClick,
  icon,
  label,
  primary = false,
  danger = false,
  disabled = false,
  className = '',
  type = 'button',
}) => {
  const baseClasses =
    'p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';
  const variantClasses = primary
    ? 'bg-crimson-600 text-white hover:bg-crimson-500 border border-crimson-400/50 shadow-md shadow-crimson-900/50'
    : danger
    ? 'bg-ember-600/20 text-ember-400 hover:bg-ember-600/40 hover:text-ember-300'
    : 'text-slate-300 bg-slate-800/50 hover:bg-slate-700/50';
  const disabledClasses = 'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <Tooltip content={label} position="bottom">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses} ${disabledClasses} ${className}`}
        aria-label={label}
      >
        <Icon name={icon} className="w-5 h-5" />
      </button>
    </Tooltip>
  );
};
import React from 'react';
import { Tooltip } from './Tooltip';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
}

const icons: { [key: string]: React.ReactNode } = {
  add: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />,
  edit: <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />,
  delete: <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.718c-1.123 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />,
  settings: <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.008 1.11-1.212l2.39-1.038c.55-.238 1.166.082 1.343.642l.666 2.088c.176.55-.082 1.166-.642 1.343l-2.39 1.038c-.55.238-1.02.328-1.212 1.11l-2.088.666c-.55.176-1.166-.082-1.343-.642l-1.038-2.39c-.238-.55.082-1.166.642-1.343l1.11-1.212zM18 12c0-1.657-1.343-3-3-3s-3 1.343-3 3 1.343 3 3 3 3-1.343 3-3zm-6.056-2.056c.55-.176 1.166.082 1.343.642l2.088.666c.193.782.283 1.252 1.11 1.212l2.39-1.038c.55-.238 1.166.082 1.343.642l.666 2.088c.176.55-.082 1.166-.642 1.343l-2.39 1.038c-.782.193-1.252.283-1.212 1.11l.666 2.088c.176.55-.082 1.166-.642 1.343l-2.39 1.038c-.55.238-1.166-.082-1.343-.642l-2.088-.666c-.193-.782-.283-1.252-1.11-1.212l-2.39 1.038c-.55.238-1.166-.082-1.343-.642l-.666-2.088c-.176-.55.082-1.166.642-1.343l2.39-1.038c.782-.193 1.252-.283 1.212-1.11l-.666-2.088c-.176-.55.082-1.166.642-1.343l2.39-1.038z" />,
  send: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />,
  close: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
  character: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
  import: <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />,
  export: <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v12" />,
  'ellipsis-vertical': <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />,
  'ellipsis-horizontal': <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />,
  'arrow-left': <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />,
  history: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
  redo: <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-11.667-11.667l3.181 3.183m0 0h-4.992m4.992 0l-3.181-3.183a8.25 8.25 0 00-11.667 0l-3.181 3.183" />,
  checkmark: <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />,
  'book-open': <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  sparkles: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 14.25h3m-3 0V18m0-3.75l-1.12-1.12M13.5 14.25L12 15.37m-1.5-1.12L9 15.37M12 4.125v1.5m0 0V4.125m0 1.5c-2.15 0-4.16.82-5.63 2.22-.38.36-.72.75-.98 1.17l-.32 1.28c-.14.54-.22 1.1-.22 1.67 0 3.3 2.69 6 6 6s6-2.7 6-6c0-.58-.08-1.13-.22-1.67l-.32-1.28a9.42 9.42 0 00-.98-1.17c-1.47-1.4-3.48-2.22-5.63-2.22z" />,
  play: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />,
  stop: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />,
  brain: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25a.75.75 0 011.5 0v3.812a3.75 3.75 0 00.3 1.352l1.378 2.755A.75.75 0 009.38 14.25h5.24a.75.75 0 00.552-1.13l-1.378-2.755a3.75 3.75 0 00.3-1.352V5.25a.75.75 0 011.5 0v3.812a5.25 5.25 0 01-.42 2.103l-1.378 2.755A2.25 2.25 0 0114.62 15.75h-5.24a2.25 2.25 0 01-1.664-3.832L6.338 9.168A5.25 5.25 0 015.25 5.25zM9.75 11.25a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />,
  fork: <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v4c0 1.1.9 2 2 2h4m0-6v4c0 1.1.9 2 2 2h2m-6 4v4c0 1.1.9 2 2 2h4" />,
  bug: <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 17.655l-1.5-1.5a2.25 2.25 0 00-3.182 0l-1.5 1.5a2.25 2.25 0 103.182 3.182l1.5-1.5a2.25 2.25 0 000-3.182zM12.75 9.655l1.5 1.5a2.25 2.25 0 003.182 0l1.5-1.5a2.25 2.25 0 10-3.182-3.182l-1.5 1.5a2.25 2.25 0 000 3.182zM4.145 13.855l1.5 1.5a2.25 2.25 0 010 3.182l-1.5 1.5a2.25 2.25 0 01-3.182-3.182l1.5-1.5a2.25 2.25 0 013.182 0zM19.855 4.145l-1.5-1.5a2.25 2.25 0 00-3.182 0l-1.5 1.5a2.25 2.25 0 103.182 3.182l1.5-1.5a2.25 2.25 0 000-3.182z" />,
  'chevron-down': <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />,
  'chevron-up': <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />,
  'new-chat': <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />,
  sliders: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />,
  terminal: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />,
  'map-pin': <><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></>,
  cube: <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9.75l-9-5.25m9 5.25v9.75" />,
  shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />,
  'minus-square': <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H3m16.5-7.5h-15A2.25 2.25 0 003.75 6.75v10.5A2.25 2.25 0 006 19.5h12a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018 4.5z" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />,
  duplicate: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75M9.75 14.25H18a2.25 2.25 0 002.25-2.25v-9.75a2.25 2.25 0 00-2.25-2.25h-9.75A2.25 2.25 0 006 4.5v9.75a2.25 2.25 0 002.25 2.25h1.5z" />,
  pin: <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 21l-4.5-4.5V3.75m9 0H7.5" />,
  globe: <><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75a9 9 0 0016.5 0" /></>,
};

export const Icon: React.FC<IconProps> = ({
  name,
  className = 'h-5 w-5',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      {...props}
    >
      {icons[name]}
    </svg>
  );
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
    'p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';
  const variantClasses = primary
    ? 'bg-sky-600 text-white hover:bg-sky-500 border border-sky-400/50 shadow-md shadow-sky-900/50'
    : danger
      ? 'bg-fuchsia-600/20 text-fuchsia-400 hover:bg-fuchsia-600/40 hover:text-fuchsia-300'
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

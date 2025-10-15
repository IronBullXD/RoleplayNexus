import React from 'react';

const ChatMessageSkeleton: React.FC = () => {
  return (
    <div className="group flex items-start gap-3 my-5 animate-message-in">
      {/* Skeleton Avatar */}
      <div className="w-10 h-10 mt-1 rounded-xl bg-slate-700 shrink-0 animate-pulse"></div>
      
      {/* Skeleton Message Bubble */}
      <div className="flex-1 min-w-0 flex justify-start">
        <div className="p-4 rounded-2xl max-w-2xl lg:max-w-3xl bg-slate-800 rounded-tl-lg chat-bubble-left">
          <div className="space-y-3">
            <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-slate-700 rounded w-full animate-pulse [animation-delay:'200ms']"></div>
            <div className="h-4 bg-slate-700 rounded w-5/6 animate-pulse [animation-delay:'400ms']"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessageSkeleton;

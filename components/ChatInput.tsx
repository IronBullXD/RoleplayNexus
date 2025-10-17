import React, { useRef, useEffect, useCallback } from 'react';
import { Icon } from './Icon';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    handleAction: () => void;
    isLoading: boolean;
    error: string | null;
    stopGeneration: () => void;
    characterName: string;
    canSubmit: boolean;
    canContinue: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    handleAction,
    isLoading,
    error,
    stopGeneration,
    characterName,
    canSubmit,
    canContinue,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.max(
                56,
                Math.min(scrollHeight, 200),
            )}px`;
        }
    }, [input]);

    const handleFormSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            handleAction();
        },
        [handleAction],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAction();
            }
        },
        [handleAction],
    );

    return (
        <div className="px-3 pb-3 pt-2 mt-auto">
            <div className="max-w-4xl w-full mx-auto">
                {error && (
                    <p className="text-red-400 text-sm mb-2 text-center bg-red-900/50 border border-red-500/50 p-2 rounded-md">
                        {error}
                    </p>
                )}
                <form onSubmit={handleFormSubmit} className="relative w-full">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${characterName}...`}
                        className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-4 pr-20 resize-none outline-none text-base text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-all duration-200 custom-scrollbar min-h-[3.5rem]"
                        rows={1}
                        disabled={isLoading}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isLoading ? (
                            <button
                                type="button"
                                onClick={stopGeneration}
                                className="w-10 h-10 flex items-center justify-center rounded-md bg-ember-600 text-white hover:bg-ember-500 transition-colors shadow-lg"
                                aria-label="Stop generation"
                            >
                                <Icon name="stop" className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!canSubmit && !canContinue}
                                className="w-10 h-10 flex items-center justify-center rounded-md bg-crimson-600 text-white disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-crimson-500 transition-colors shadow-lg shadow-crimson-900/50"
                                aria-label={
                                    canContinue ? 'Continue generation' : 'Send message'
                                }
                            >
                                <Icon
                                    name={canContinue ? 'ellipsis-horizontal' : 'send'}
                                    className="w-5 h-5"
                                />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatInput;
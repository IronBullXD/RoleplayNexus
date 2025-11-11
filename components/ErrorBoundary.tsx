import React, { ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/logger';
import { Icon } from './Icon';

type ErrorBoundaryProps = React.PropsWithChildren<{}>;

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  // FIX: Reverted state initialization to use a class property.
  // The constructor-based initialization was causing issues with `this` context in some build environments.
  state: State = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // FIX: Using an arrow function for lifecycle methods ensures `this` is correctly bound.
  // Changed to a regular class method as React binds `this` for lifecycle methods automatically.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught UI Error', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
    });
    console.error('Uncaught error:', error, errorInfo);
  }

  // Use arrow function for event handler to automatically bind `this`
  handleResetAndReload = (): void => {
    logger.log('Attempting to clear storage and reload from error boundary.');
    try {
      window.localStorage.clear();
    } catch (e) {
      logger.error('Failed to clear local storage', e);
    }
    window.location.reload();
  }

  // FIX: Using an arrow function for render ensures `this` is correctly bound, resolving issues where 'this.props' might not be found.
  // Changed to a regular class method as React binds `this` for lifecycle methods automatically.
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-2xl text-center shadow-2xl shadow-red-900/50">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="bug" className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-red-400">
              Oops! Something went wrong.
            </h1>
            <p className="mt-2 text-slate-400">
              The application encountered a critical error and cannot continue.
            </p>

            <div className="mt-4 p-3 bg-slate-800/50 rounded-md text-left text-sm font-mono text-red-300 overflow-auto max-h-40">
              <p className="font-semibold">{this.state.error?.message}</p>
              <pre className="text-xs whitespace-pre-wrap mt-2 opacity-70">
                {this.state.error?.stack}
              </pre>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              You can try reloading the page. If the problem persists, you may
              need to reset the application state. All error details have been
              logged to the debug console, which you can access from the main
              screen after reloading.
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="px-4 py-2 text-sm font-medium text-red-300 bg-red-600/20 hover:bg-red-600/40 rounded-lg transition-colors"
              >
                Reset and Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
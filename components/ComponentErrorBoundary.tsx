import React, { ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/logger';
import { Icon } from './Icon';

type Props = React.PropsWithChildren<{
  componentName?: string;
}>;

interface State {
  hasError: boolean;
  error?: Error;
}

class ComponentErrorBoundary extends React.Component<Props, State> {
  // FIX: Reverted state initialization to use a class property.
  // The constructor-based initialization was causing issues with `this` context in some build environments.
  state: State = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // FIX: Use an arrow function for lifecycle methods to ensure `this` is correctly bound, resolving issues where 'this.props' might not be found.
  componentDidCatch = (error: Error, errorInfo: ErrorInfo) => {
    logger.error(
      `Error in component: ${this.props.componentName || 'Unknown'}`,
      {
        error: {
          message: error.message,
          stack: error.stack,
        },
        componentStack: errorInfo.componentStack,
      },
    );
  }

  // Use arrow function for event handler to automatically bind `this`
  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  }

  // FIX: Use an arrow function for render to ensure `this` is correctly bound, resolving issues where 'this.props' and 'this.setState' might not be found.
  render = (): ReactNode => {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 m-4 text-red-300">
          <div className="flex items-center gap-3">
            <Icon name="alert-triangle" className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold">
                Error in {this.props.componentName || 'this component'}
              </h3>
              <p className="text-xs mt-1 font-mono">
                {this.state.error?.message || 'An unknown error occurred.'}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ComponentErrorBoundary;
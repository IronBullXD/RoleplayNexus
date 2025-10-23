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
  state: State = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // FIX: Converted to a standard class method. React binds `this` for lifecycle methods.
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // FIX: Access props via `this.props` in a class component.
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

  // FIX: The handler remains an arrow function to automatically bind `this`.
  handleRetry = (): void => {
    // FIX: Access setState via `this.setState` in a class component.
    this.setState({ hasError: false, error: undefined });
  };

  // FIX: Converted to a standard class method. React binds `this` for lifecycle methods.
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 m-4 text-red-300">
          <div className="flex items-center gap-3">
            <Icon name="alert-triangle" className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold">
                {/* FIX: Access props via `this.props` in a class component. */}
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

    // FIX: Access props via `this.props` in a class component.
    return this.props.children;
  }
}

export default ComponentErrorBoundary;
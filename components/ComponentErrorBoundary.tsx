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
  // FIX: Replaced public class field with a constructor for broader compatibility.
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
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

  // handleRetry is an event handler, so it's defined as an arrow function to preserve 'this' context.
  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
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
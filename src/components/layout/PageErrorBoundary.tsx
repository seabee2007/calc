import React from 'react';
import Button from '../ui/Button';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
}

export default class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PageErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
              {this.props.title ?? 'Something went wrong'}
            </h2>
            <p className="mt-2 text-sm text-red-800 dark:text-red-200">
              This page failed to load. Refresh and try again.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

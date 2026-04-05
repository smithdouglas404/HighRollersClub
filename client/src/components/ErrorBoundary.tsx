import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Something went wrong";
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">&#x26A0;</div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-gray-400">
              An unexpected error occurred. Please try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors"
            >
              Reload Page
            </button>
            <div>
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                {this.state.showDetails ? "Hide details" : "Show details"}
              </button>
              {this.state.showDetails && this.state.error && (
                <pre className="mt-2 p-3 rounded bg-black/50 text-left text-xs text-red-400 overflow-auto max-h-48">
                  {this.state.error.message}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

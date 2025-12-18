import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Something went wrong</h1>
          </div>
          
          <p className="max-w-md text-center text-muted-foreground">
            An unexpected error occurred. Please try refreshing the application.
          </p>
          
          {this.state.error && (
            <pre className="max-w-lg overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          
          <Button 
            onClick={this.handleReset}
            className="mt-4"
            aria-label="Try again"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

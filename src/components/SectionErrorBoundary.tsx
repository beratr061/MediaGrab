import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type ErrorBoundaryVariant = "inline" | "card" | "minimal";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  variant?: ErrorBoundaryVariant;
  sectionName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Granular Error Boundary for specific sections/components
 * Use this to wrap individual features so errors don't crash the entire app
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.sectionName || 'Section'}] Error:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { variant = "card", sectionName, className } = this.props;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (variant === "minimal") {
        return (
          <div className={cn("flex items-center gap-2 text-sm text-destructive p-2", className)}>
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to load {sectionName || "section"}</span>
            <button
              onClick={this.handleReset}
              className="text-primary hover:underline ml-2"
            >
              Retry
            </button>
          </div>
        );
      }

      if (variant === "inline") {
        return (
          <div 
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3",
              className
            )}
            role="alert"
          >
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {sectionName ? `${sectionName} failed to load` : "Something went wrong"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              className="h-7 px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        );
      }

      // Card variant (default)
      return (
        <div 
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6",
            className
          )}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-medium">
              {sectionName ? `${sectionName} Error` : "Something went wrong"}
            </h3>
          </div>
          
          {this.state.error && (
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {this.state.error.message}
            </p>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with SectionErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<Props, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary {...options}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    );
  };
}

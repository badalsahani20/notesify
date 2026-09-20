import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-strong)]">
            {this.props.fallbackTitle || "Something went wrong"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-[var(--muted-text)]">
            {this.state.error?.message || "An unexpected error occurred while rendering this view."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="text-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              Try again
            </Button>
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Reload app
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

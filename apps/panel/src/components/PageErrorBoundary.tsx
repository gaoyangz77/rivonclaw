import { Component, type ErrorInfo, type ReactNode } from "react";

interface PageErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  title: string;
  message: string;
  retryLabel: string;
}

interface PageErrorBoundaryState {
  error: Error | null;
}

/** Keeps the application shell usable when one route fails during render. */
export class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page render failed", error, info);
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="tk-v1-page-error" role="alert">
        <span className="tk-v1-page-error-code">PAGE / RECOVERY</span>
        <h1>{this.props.title}</h1>
        <p>{this.props.message}</p>
        <button
          type="button"
          className="tk-v1-button tk-v1-button-secondary tk-v1-button-md"
          onClick={() => window.location.reload()}
        >
          {this.props.retryLabel}
        </button>
      </section>
    );
  }
}

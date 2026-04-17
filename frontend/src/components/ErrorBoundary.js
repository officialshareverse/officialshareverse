import React from "react";

import BrandMark from "./BrandMark";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App-level error boundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="sv-error-boundary">
        <div className="sv-error-boundary-card">
          <div className="sv-error-boundary-brand">
            <BrandMark glow sizeClass="h-12 w-12" roundedClass="rounded-[18px]" />
            <span className="sv-eyebrow">ShareVerse Recovery</span>
          </div>

          <h1 className="sv-display mt-5 max-w-xl">Something broke before the page could finish loading.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Your data is still safe. Reload the app to retry, or jump back to the home page and continue from there.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={this.handleRetry} className="sv-btn">
              Reload app
            </button>
            <button type="button" onClick={this.handleGoHome} className="sv-btn-secondary">
              Go to home
            </button>
          </div>

          {this.state.error?.message ? (
            <details className="sv-error-boundary-details">
              <summary>Technical details</summary>
              <pre>{this.state.error.message}</pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}

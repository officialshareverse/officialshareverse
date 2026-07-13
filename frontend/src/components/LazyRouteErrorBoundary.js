import { Component } from "react";
import BrandMark from "./BrandMark";

export default class LazyRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  isChunkLoadError(error) {
    if (!error) return false;
    if (error.name === "ChunkLoadError") return true;
    return /Loading chunk \d+ failed|Loading CSS chunk \d+ failed/i.test(
      error.message || ""
    );
  }

  handleReload = () => {
    // The only reliable way to re-fetch a chunk after webpack caches the
    // failed import promise at module scope is a full page reload.
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      if (this.isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <BrandMark sizeClass="h-10 w-10 mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              We couldn't load this page.
            </h2>
            <p className="text-sm text-slate-500 mb-6 text-center">
              A network issue prevented part of the app from loading.
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-teal-500 text-white font-semibold"
              >
                Retry loading
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg border border-slate-300 font-semibold"
              >
                Go to home
              </button>
            </div>
          </div>
        );
      }
      // Non-chunk errors: re-throw to the parent ErrorBoundary.
      throw this.state.error;
    }
    return this.props.children;
  }
}

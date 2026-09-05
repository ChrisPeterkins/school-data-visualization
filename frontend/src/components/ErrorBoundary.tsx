import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

/**
 * Route-level error boundary. A failing page shows a retry instead of a
 * blank screen, and navigating elsewhere (resetKey changes) clears it.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card-surface border-brick-200 bg-brick-50 p-6">
          <h1 className="text-lg font-semibold text-brick-800">Something went wrong on this page</h1>
          <p className="mt-1 text-sm text-brick-700">{this.state.error.message}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => this.setState({ error: null })} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-navy-700 text-white hover:bg-navy-600">Try again</button>
            <button onClick={() => window.location.reload()} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">Reload</button>
          </div>
        </div>
      </div>
    );
  }
}

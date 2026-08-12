import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, correlationId: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      correlationId: `err-${Math.random().toString(36).substring(2, 10)}`,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled UI error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, correlationId: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '2.5rem',
          margin: '2rem auto',
          maxWidth: '560px',
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1.25rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            fontSize: '1.5rem',
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem', color: '#f1f5f9' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            An unexpected error occurred in this view. The issue has been logged securely.
          </p>

          {this.state.correlationId && (
            <div style={{
              background: '#1e293b',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: '#cbd5e1',
              margin: '0 0 1.5rem',
              display: 'inline-block',
            }}>
              Reference Code: {this.state.correlationId}
            </div>
          )}

          <div>
            <button
              onClick={this.handleReset}
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

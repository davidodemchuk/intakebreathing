import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#0a0a0a', color: '#00FEA9', minHeight: '100vh' }}>
          <div style={{ fontSize: 18, marginBottom: 16 }}>Runtime Error — copy this and send to David:</div>
          <pre style={{ color: '#ff4444', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.toString()}</pre>
          <pre style={{ color: '#737373', whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 16 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary><App /></RootErrorBoundary>
);

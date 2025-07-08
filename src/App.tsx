import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TestCases } from './pages/TestCases';
import { TestRuns } from './pages/TestRuns';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { LLMAssistant } from './pages/LLMAssistant';
import { TestFactory } from './pages/TestFactory.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <Router>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/test-cases" element={<TestCases />} />
            <Route path="/test-runs" element={
              <ErrorBoundary>
                <TestRuns />
              </ErrorBoundary>
            } />
            <Route path="/reports" element={<Reports />} />
            <Route path="/llm-assistant" element={<LLMAssistant />} />
            <Route path="/test-factory" element={<TestFactory />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
}

export default App;
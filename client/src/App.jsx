import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TestSuite from './pages/TestSuite';
import TestCaseEditor from './pages/TestCaseEditor';
import Schedules from './pages/Schedules';
import ExecutionHistory from './pages/ExecutionHistory';
import ExecutionReport from './pages/ExecutionReport';

function App() {
  return (
    <SocketProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/suite/:suiteId" element={<TestSuite />} />
            <Route path="/suite/:suiteId/test-case/new" element={<TestCaseEditor />} />
            <Route path="/suite/:suiteId/test-case/:testCaseId" element={<TestCaseEditor />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/history" element={<ExecutionHistory />} />
            <Route path="/history/:executionId" element={<ExecutionReport />} />
          </Routes>
        </Layout>
      </Router>
    </SocketProvider>
  );
}

export default App;

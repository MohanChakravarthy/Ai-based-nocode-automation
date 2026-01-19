import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  ArrowLeft, 
  Play, 
  Trash2, 
  TestTube2,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical
} from 'lucide-react';

export default function TestSuite() {
  const { suiteId } = useParams();
  const navigate = useNavigate();
  const [suite, setSuite] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);

  useEffect(() => {
    fetchSuiteData();
  }, [suiteId]);

  const fetchSuiteData = async () => {
    try {
      const [suiteRes, casesRes] = await Promise.all([
        fetch(`/api/test-suites/${suiteId}`),
        fetch(`/api/test-suites/${suiteId}/test-cases`)
      ]);
      
      if (!suiteRes.ok) {
        navigate('/');
        return;
      }

      const suiteData = await suiteRes.json();
      const casesData = await casesRes.json();
      
      setSuite(suiteData);
      setTestCases(casesData);
    } catch (error) {
      console.error('Failed to fetch suite data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTestCase = async (testCase, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setRunningId(testCase.id);
    
    try {
      await fetch(`/api/test-cases/${testCase.id}/run`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to run test case:', error);
    } finally {
      setTimeout(() => setRunningId(null), 1000);
    }
  };

  const deleteTestCase = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      await fetch(`/api/test-cases/${id}`, { method: 'DELETE' });
      setTestCases(testCases.filter(tc => tc.id !== id));
    } catch (error) {
      console.error('Failed to delete test case:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{suite?.name}</h1>
            {suite?.description && (
              <p className="text-gray-500 mt-1">{suite.description}</p>
            )}
          </div>
          <Link
            to={`/suite/${suiteId}/test-case/new`}
            className="btn-primary"
          >
            <Plus className="w-5 h-5" />
            New Test Case
          </Link>
        </div>
      </div>

      {/* Test Cases List */}
      {testCases.length === 0 ? (
        <div className="card text-center py-12">
          <TestTube2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No test cases yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first test case to start automating
          </p>
          <Link
            to={`/suite/${suiteId}/test-case/new`}
            className="btn-primary mx-auto"
          >
            <Plus className="w-5 h-5" />
            Create Test Case
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {testCases.map((testCase) => (
            <Link
              key={testCase.id}
              to={`/suite/${suiteId}/test-case/${testCase.id}`}
              className="card flex items-center justify-between hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <TestTube2 className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {testCase.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">
                      {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                    </span>
                    {testCase.jiraTestCaseId && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {testCase.jiraTestCaseId}
                      </span>
                    )}
                    {testCase.lastStatus && (
                      <div className="flex items-center gap-1">
                        {getStatusIcon(testCase.lastStatus)}
                        <span className="text-xs text-gray-500">
                          {testCase.lastRun && new Date(testCase.lastRun).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => runTestCase(testCase, e)}
                  disabled={runningId === testCase.id}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Run test case"
                >
                  {runningId === testCase.id ? (
                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={(e) => deleteTestCase(testCase.id, e)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete test case"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  FileText,
  Image
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { executionComplete } = useSocket();

  useEffect(() => {
    fetchExecutions();
  }, []);

  useEffect(() => {
    if (executionComplete) {
      setExecutions(prev => [executionComplete, ...prev.slice(0, 49)]);
    }
  }, [executionComplete]);

  const fetchExecutions = async () => {
    try {
      const response = await fetch('/api/executions');
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
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
        <h1 className="text-2xl font-bold text-gray-900">Execution History</h1>
        <p className="text-gray-500 mt-1">View past test execution results</p>
      </div>

      {/* Executions List */}
      {executions.length === 0 ? (
        <div className="card text-center py-12">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No execution history
          </h3>
          <p className="text-gray-500">
            Run some test cases to see their results here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((execution) => {
            const hasScreenshots = execution.stepResults?.some(s => s.screenshotUrl || s.screenshot === 'has_screenshot' || s.screenshot);
            const passedSteps = execution.stepResults?.filter(s => s.status === 'completed' || s.status === 'passed').length || 0;
            const totalSteps = execution.stepResults?.length || 0;
            
            return (
              <Link
                key={execution.executionId}
                to={`/history/${execution.executionId}`}
                className="card block hover:shadow-md hover:border-primary-200 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(execution.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {execution.testCaseName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusBadge(execution.status)}`}>
                          {execution.status === 'passed' ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {passedSteps}/{totalSteps} steps
                        </span>
                        <span className="text-sm text-gray-500">
                          {(execution.duration / 1000).toFixed(1)}s
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(execution.completedAt).toLocaleString()}
                        </span>
                        {hasScreenshots && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Image className="w-3 h-3" />
                            Screenshots
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Report
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

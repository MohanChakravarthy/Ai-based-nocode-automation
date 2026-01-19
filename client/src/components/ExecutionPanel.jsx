import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronRight,
  Minimize2,
  Maximize2
} from 'lucide-react';

export default function ExecutionPanel() {
  const { executionProgress, executionComplete, clearExecution } = useSocket();
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (executionProgress) {
      setLogs(prev => {
        const exists = prev.find(l => 
          l.currentStep === executionProgress.currentStep && 
          l.status === executionProgress.status
        );
        if (exists) return prev;
        return [...prev, executionProgress];
      });
    }
  }, [executionProgress]);

  useEffect(() => {
    if (executionComplete) {
      // Keep logs for viewing
    }
  }, [executionComplete]);

  const handleClose = () => {
    clearExecution();
    setLogs([]);
  };

  if (!executionProgress && !executionComplete) return null;

  const isRunning = executionProgress && !executionComplete;
  const status = executionComplete?.status || 'running';

  return (
    <div 
      className={`fixed right-4 bottom-4 bg-white rounded-xl shadow-2xl border border-gray-200 transition-all duration-300 ${
        isMinimized ? 'w-80' : 'w-96'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-100 ${
        status === 'passed' ? 'bg-green-50' : 
        status === 'failed' ? 'bg-red-50' : 
        'bg-primary-50'
      }`}>
        <div className="flex items-center gap-3">
          {isRunning ? (
            <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
          ) : status === 'passed' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {executionProgress?.testCaseName || executionComplete?.testCaseName}
            </h3>
            <p className="text-xs text-gray-500">
              {isRunning ? 'Running...' : status === 'passed' ? 'Completed' : 'Failed'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-gray-500" />
            ) : (
              <Minimize2 className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {!isMinimized && (
        <>
          {isRunning && executionProgress && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-gray-900">
                  {executionProgress.currentStep} / {executionProgress.totalSteps}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ 
                    width: `${(executionProgress.currentStep / executionProgress.totalSteps) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="max-h-64 overflow-y-auto p-4 space-y-2">
            {logs.map((log, index) => (
              <div 
                key={index}
                className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                  log.status === 'completed' ? 'bg-green-50' :
                  log.status === 'failed' ? 'bg-red-50' :
                  log.status === 'running' ? 'bg-blue-50' :
                  'bg-gray-50'
                }`}
              >
                {log.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />
                ) : log.status === 'completed' || log.status === 'passed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 break-words">{log.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Duration */}
          {executionComplete && (
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium text-gray-900">
                  {(executionComplete.duration / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

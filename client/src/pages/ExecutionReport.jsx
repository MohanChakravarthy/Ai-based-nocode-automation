import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Image, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export default function ExecutionReport() {
  const { executionId } = useParams();
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    fetchExecution();
  }, [executionId]);

  const fetchExecution = async () => {
    try {
      const response = await fetch(`/api/executions/${executionId}`);
      if (response.ok) {
        const data = await response.json();
        setExecution(data);
        if (data.stepResults?.length > 0) {
          setSelectedStep(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch execution:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'passed' || status === 'completed') return 'text-green-600 bg-green-100';
    if (status === 'failed') return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    if (status === 'passed' || status === 'completed') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const navigateStep = (direction) => {
    if (!execution?.stepResults) return;
    const newIndex = selectedStep + direction;
    if (newIndex >= 0 && newIndex < execution.stepResults.length) {
      setSelectedStep(newIndex);
    }
  };

  const getScreenshotUrl = (step) => {
    if (step?.screenshotUrl) {
      return `http://localhost:3001${step.screenshotUrl}`;
    }
    return null;
  };

  const downloadScreenshot = (screenshotUrl, stepNum) => {
    if (!screenshotUrl) return;
    const link = document.createElement('a');
    link.href = screenshotUrl;
    link.download = `step-${stepNum}-screenshot.png`;
    link.target = '_blank';
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Execution not found</p>
        <Link to="/history" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to History
        </Link>
      </div>
    );
  }

  const currentStepData = execution.stepResults?.[selectedStep];

  return (
    <div>
      <Link to="/history" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to History
      </Link>

      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${execution.status === 'passed' ? 'bg-green-100' : 'bg-red-100'}`}>
              {execution.status === 'passed' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{execution.testCaseName}</h1>
              <div className="flex items-center gap-4 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(execution.status)}`}>
                  {execution.status === 'passed' ? 'PASSED' : 'FAILED'}
                </span>
                <span className="text-gray-500">Duration: {(execution.duration / 1000).toFixed(1)}s</span>
                <span className="text-gray-500">{new Date(execution.completedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Image className="w-5 h-5" />
                Step Screenshot
              </h2>
              {getScreenshotUrl(currentStepData) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateStep(-1)}
                    disabled={selectedStep === 0}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-500">
                    {selectedStep + 1} / {execution.stepResults?.length || 0}
                  </span>
                  <button
                    onClick={() => navigateStep(1)}
                    disabled={selectedStep === (execution.stepResults?.length || 0) - 1}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => downloadScreenshot(getScreenshotUrl(currentStepData), currentStepData.stepNumber)}
                    className="p-2 hover:bg-gray-100 rounded-lg ml-2"
                    title="Download screenshot"
                  >
                    <Download className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {getScreenshotUrl(currentStepData) ? (
              <div 
                className="bg-gray-900 rounded-lg p-4 cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={getScreenshotUrl(currentStepData)}
                  alt={`Step ${currentStepData.stepNumber} screenshot`}
                  className="w-full rounded-lg"
                />
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-12 text-center">
                <Image className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No screenshot available</p>
              </div>
            )}

            {currentStepData && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(currentStepData.status)}
                  <span className="font-medium text-gray-900">
                    {currentStepData.stepNumber === 0 ? 'Initialization' : `Step ${currentStepData.stepNumber}`}
                  </span>
                </div>
                <p className="text-gray-700">{currentStepData.stepDescription}</p>
                {currentStepData.status === 'failed' && (
                  <p className="text-red-600 mt-2 text-sm">{currentStepData.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(currentStepData.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">All Steps</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {execution.stepResults?.map((step, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedStep(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedStep === index
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(step.status)}
                    <span className="font-medium text-gray-900 text-sm">
                      {step.stepNumber === 0 ? 'Init' : `Step ${step.stepNumber}`}
                    </span>
                    {step.screenshotUrl && (
                      <Image className="w-3 h-3 text-gray-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{step.stepDescription}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card mt-4">
            <h2 className="font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Steps</span>
                <span className="font-medium">{execution.stepResults?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Passed</span>
                <span className="font-medium text-green-600">
                  {execution.stepResults?.filter(s => s.status === 'completed' || s.status === 'passed').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Failed</span>
                <span className="font-medium text-red-600">
                  {execution.stepResults?.filter(s => s.status === 'failed').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{(execution.duration / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && getScreenshotUrl(currentStepData) && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img
            src={getScreenshotUrl(currentStepData)}
            alt="Full screenshot"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

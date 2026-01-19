import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { X, CheckCircle2, XCircle, Loader2, Monitor, Maximize2, Minimize2 } from 'lucide-react';

function StepItem({ step }) {
  const getStepStyles = () => {
    if (step.status === 'completed' || step.status === 'passed') return 'bg-green-50 border-green-200';
    if (step.status === 'failed') return 'bg-red-50 border-red-200';
    if (step.status === 'running') return 'bg-blue-50 border-blue-200 animate-pulse';
    return 'bg-white border-gray-200';
  };

  const renderIcon = () => {
    if (step.status === 'running') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />;
    if (step.status === 'completed' || step.status === 'passed') return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />;
    if (step.status === 'failed') return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />;
    return <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />;
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${getStepStyles()}`}>
      <div className="flex items-start gap-2">
        {renderIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {step.currentStep > 0 ? `Step ${step.currentStep}` : 'Initialize'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 break-words">{step.stepDescription}</p>
          {step.status === 'failed' && <p className="text-xs text-red-600 mt-1">{step.message}</p>}
        </div>
      </div>
    </div>
  );
}

function BrowserPreview({ screencastFrame, fallbackUrl }) {
  // Use screencast frame (real-time) or fallback to screenshot URL
  const imageSrc = screencastFrame || (fallbackUrl && fallbackUrl.startsWith('/screenshots/') 
    ? `http://localhost:3001${fallbackUrl}` 
    : null);

  return (
    <div className="flex-1 bg-gray-900 flex flex-col">
      <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 ml-4">
          <div className="bg-gray-700 rounded-md px-4 py-1.5 text-gray-300 text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            <span>Live Browser View</span>
            {screencastFrame && <span className="text-green-400 text-xs ml-2">● Live</span>}
            {!screencastFrame && imageSrc && <span className="text-blue-400 text-xs ml-2">Connected</span>}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-gray-950">
        {imageSrc ? (
          <img 
            src={imageSrc}
            alt="Browser view"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            style={{ imageRendering: 'auto' }}
          />
        ) : (
          <div className="text-gray-500 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Waiting for browser...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveExecutionView({ onClose }) {
  const { executionProgress, executionComplete, screencastFrame, clearExecution } = useSocket();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [steps, setSteps] = useState([]);
  const stepsRef = useRef(null);

  useEffect(() => {
    if (!executionProgress) return;
    
    // Update steps list with screenshot
    setSteps(prev => {
      const idx = prev.findIndex(s => s.currentStep === executionProgress.currentStep);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...executionProgress };
        return updated;
      }
      return [...prev, { ...executionProgress }];
    });
  }, [executionProgress]);

  // Get the latest screenshot from steps array - find the last step with a screenshot (fallback)
  const getLatestScreenshot = () => {
    // First check if we have stepResults from execution complete
    if (executionComplete?.stepResults?.length > 0) {
      for (let i = executionComplete.stepResults.length - 1; i >= 0; i--) {
        if (executionComplete.stepResults[i]?.screenshotUrl) {
          return executionComplete.stepResults[i].screenshotUrl;
        }
      }
    }
    // Otherwise get from steps array
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i]?.screenshotUrl) {
        return steps[i].screenshotUrl;
      }
    }
    return null;
  };

  const fallbackScreenshot = getLatestScreenshot();

  useEffect(() => {
    if (stepsRef.current) stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
  }, [steps]);

  const handleClose = () => {
    clearExecution();
    setSteps([]);
    onClose?.();
  };

  if (!executionProgress && !executionComplete) return null;

  const isRunning = executionProgress && !executionComplete;
  const finalStatus = executionComplete?.status || 'running';
  const testName = executionProgress?.testCaseName || executionComplete?.testCaseName;

  const getHeaderBg = () => {
    if (finalStatus === 'passed') return 'bg-green-50';
    if (finalStatus === 'failed') return 'bg-red-50';
    return 'bg-primary-50';
  };

  const getIconBg = () => {
    if (finalStatus === 'passed') return 'bg-green-100';
    if (finalStatus === 'failed') return 'bg-red-100';
    return 'bg-primary-100';
  };

  const renderStatusIcon = () => {
    if (isRunning) return <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />;
    if (finalStatus === 'passed') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusText = () => {
    if (isRunning) return <span className="flex items-center gap-2"><span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />Running automation...</span>;
    if (finalStatus === 'passed') return 'Test completed successfully';
    return 'Test failed';
  };

  const progressPercent = executionProgress ? Math.round((executionProgress.currentStep / executionProgress.totalSteps) * 100) : 0;

  return (
    <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[85vh]'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-200 ${getHeaderBg()}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconBg()}`}>
              {renderStatusIcon()}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{testName}</h2>
              <p className="text-sm text-gray-500">{getStatusText()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {executionComplete && <span className="text-sm text-gray-500 mr-4">Duration: {(executionComplete.duration / 1000).toFixed(1)}s</span>}
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-white/50 rounded-lg">
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-gray-600" /> : <Maximize2 className="w-5 h-5 text-gray-600" />}
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-white/50 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <BrowserPreview screencastFrame={screencastFrame} fallbackUrl={fallbackScreenshot} />
          
          <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-900">Execution Steps</h3>
              {executionProgress && <p className="text-sm text-gray-500">Step {executionProgress.currentStep} of {executionProgress.totalSteps}</p>}
            </div>
            
            <div ref={stepsRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {steps.map((step, i) => <StepItem key={i} step={step} />)}
            </div>

            {isRunning && executionProgress && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            {executionComplete && (
              <div className={`p-4 border-t ${finalStatus === 'passed' ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {finalStatus === 'passed' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className={`font-semibold ${finalStatus === 'passed' ? 'text-green-700' : 'text-red-700'}`}>
                    {finalStatus === 'passed' ? 'Test Passed!' : 'Test Failed'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  GripVertical,
  Wand2,
  Download,
  FileText
} from 'lucide-react';

export default function TestCaseEditor() {
  const { suiteId, testCaseId } = useParams();
  const navigate = useNavigate();
  const isNew = testCaseId === 'new' || !testCaseId;

  const [name, setName] = useState('');
  const [steps, setSteps] = useState(['']);
  const [jiraTestCaseId, setJiraTestCaseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [fetchingJira, setFetchingJira] = useState(false);
  const [interpretingAI, setInterpretingAI] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetchTestCase();
    }
  }, [testCaseId]);

  const fetchTestCase = async () => {
    try {
      const response = await fetch(`/api/test-suites/${suiteId}/test-cases`);
      const cases = await response.json();
      const testCase = cases.find(tc => tc.id === testCaseId);
      
      if (testCase) {
        setName(testCase.name);
        setSteps(testCase.steps.length > 0 ? testCase.steps : ['']);
        setJiraTestCaseId(testCase.jiraTestCaseId || '');
      }
    } catch (error) {
      console.error('Failed to fetch test case:', error);
    }
  };

  const addStep = () => {
    setSteps([...steps, '']);
  };

  const updateStep = (index, value) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const removeStep = (index) => {
    if (steps.length === 1) {
      setSteps(['']);
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const saveTestCase = async () => {
    if (!name.trim()) {
      alert('Please enter a test case name');
      return;
    }

    const filteredSteps = steps.filter(s => s.trim());
    if (filteredSteps.length === 0) {
      alert('Please add at least one step');
      return;
    }

    setSaving(true);

    try {
      const url = isNew 
        ? `/api/test-suites/${suiteId}/test-cases`
        : `/api/test-cases/${testCaseId}`;
      
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          steps: filteredSteps,
          jiraTestCaseId: jiraTestCaseId || null
        })
      });

      if (response.ok) {
        navigate(`/suite/${suiteId}`);
      }
    } catch (error) {
      console.error('Failed to save test case:', error);
    } finally {
      setSaving(false);
    }
  };

  const runTestCase = async () => {
    if (isNew) {
      alert('Please save the test case first');
      return;
    }

    setRunning(true);

    try {
      await fetch(`/api/test-cases/${testCaseId}/run`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to run test case:', error);
    } finally {
      setTimeout(() => setRunning(false), 1000);
    }
  };

  const fetchFromJira = async () => {
    if (!jiraTestCaseId.trim()) return;

    setFetchingJira(true);

    try {
      const response = await fetch('/api/jira/fetch-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId: jiraTestCaseId })
      });

      const data = await response.json();
      
      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
        setShowJiraModal(false);
      }
    } catch (error) {
      console.error('Failed to fetch from Jira:', error);
    } finally {
      setFetchingJira(false);
    }
  };

  const interpretWithAI = async () => {
    if (!aiInput.trim()) return;

    setInterpretingAI(true);

    try {
      const response = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naturalLanguageSteps: aiInput })
      });

      const data = await response.json();
      
      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
        setShowAIModal(false);
        setAiInput('');
      }
    } catch (error) {
      console.error('Failed to interpret with AI:', error);
    } finally {
      setInterpretingAI(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to={`/suite/${suiteId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Test Suite
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Create Test Case' : 'Edit Test Case'}
          </h1>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={runTestCase}
                disabled={running}
                className="btn-secondary"
              >
                {running ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Run
              </button>
            )}
            <button
              onClick={saveTestCase}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Test Case Name */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Case Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Add product to cart"
          className="input"
        />
      </div>

      {/* Import Options */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowAIModal(true)}
          className="btn-secondary flex-1"
        >
          <Wand2 className="w-5 h-5" />
          AI Natural Language
        </button>
        <button
          onClick={() => setShowJiraModal(true)}
          className="btn-secondary flex-1"
        >
          <Download className="w-5 h-5" />
          Import from Jira
        </button>
      </div>

      {/* Steps */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Test Steps</h2>
          <button
            onClick={addStep}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="step-item group">
              <div className="flex items-center gap-2 text-gray-400">
                <GripVertical className="w-4 h-4 cursor-grab" />
                <span className="text-sm font-medium w-6">{index + 1}.</span>
              </div>
              <input
                type="text"
                value={step}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`Step ${index + 1}: e.g., Navigate to "flipkart.com"`}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-700"
              />
              <button
                onClick={() => removeStep(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addStep}
          className="mt-4 w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Another Step
        </button>
      </div>

      {/* Example Steps */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Example Steps
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Open browser</li>
          <li>2. Navigate to "flipkart.com"</li>
          <li>3. Search for "mobiles"</li>
          <li>4. Select 4th product</li>
          <li>5. Add the product to the cart</li>
        </ul>
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary-600" />
              AI Step Interpreter
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Enter your test steps in natural language and AI will interpret them.
            </p>
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder={`Enter steps like:\n1. Open browser\n2. Navigate to flipkart.com\n3. Search for mobiles\n4. Select 4th product\n5. Add to cart`}
              className="input min-h-[200px] resize-none font-mono text-sm"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAIModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={interpretWithAI}
                disabled={interpretingAI || !aiInput.trim()}
                className="btn-primary flex-1"
              >
                {interpretingAI ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Wand2 className="w-5 h-5" />
                )}
                Interpret Steps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jira Modal */}
      {showJiraModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Import from Jira
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Enter a Jira Test Case ID to fetch steps automatically.
            </p>
            <input
              type="text"
              value={jiraTestCaseId}
              onChange={(e) => setJiraTestCaseId(e.target.value)}
              placeholder="e.g., TC-001"
              className="input"
            />
            <p className="text-xs text-gray-400 mt-2">
              Try: TC-001, TC-002, or TC-003 for demo data
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowJiraModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={fetchFromJira}
                disabled={fetchingJira || !jiraTestCaseId.trim()}
                className="btn-primary flex-1"
              >
                {fetchingJira ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                Fetch Steps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

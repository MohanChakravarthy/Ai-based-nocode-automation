import { useState, useEffect } from 'react';
import { 
  Plus, 
  Clock, 
  Trash2, 
  Calendar,
  Play,
  AlertCircle
} from 'lucide-react';

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState('');
  const [scheduleType, setScheduleType] = useState('once');
  const [scheduledTime, setScheduledTime] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schedulesRes, suitesRes] = await Promise.all([
        fetch('/api/schedules'),
        fetch('/api/test-suites')
      ]);

      const schedulesData = await schedulesRes.json();
      const suitesData = await suitesRes.json();

      // Fetch all test cases from all suites
      const allTestCases = [];
      for (const suite of suitesData) {
        const casesRes = await fetch(`/api/test-suites/${suite.id}/test-cases`);
        const cases = await casesRes.json();
        allTestCases.push(...cases.map(tc => ({ ...tc, suiteName: suite.name })));
      }

      setSchedules(schedulesData);
      setTestCases(allTestCases);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async (e) => {
    e.preventDefault();
    if (!selectedTestCase) return;

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: selectedTestCase,
          scheduledTime: scheduleType === 'once' ? scheduledTime : null,
          cronExpression: scheduleType === 'recurring' ? cronExpression : null
        })
      });

      const newSchedule = await response.json();
      setSchedules([...schedules, newSchedule]);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create schedule:', error);
    }
  };

  const deleteSchedule = async (id) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      setSchedules(schedules.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const resetForm = () => {
    setSelectedTestCase('');
    setScheduleType('once');
    setScheduledTime('');
    setCronExpression('');
  };

  const getTestCaseName = (testCaseId) => {
    const tc = testCases.find(t => t.id === testCaseId);
    return tc ? tc.name : 'Unknown';
  };

  const formatScheduleTime = (schedule) => {
    if (schedule.scheduledTime) {
      return new Date(schedule.scheduledTime).toLocaleString();
    }
    if (schedule.cronExpression) {
      return `Recurring: ${schedule.cronExpression}`;
    }
    return 'Unknown';
  };

  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  ];

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Runs</h1>
          <p className="text-gray-500 mt-1">Schedule test cases to run automatically</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          disabled={testCases.length === 0}
        >
          <Plus className="w-5 h-5" />
          Schedule Run
        </button>
      </div>

      {/* No Test Cases Warning */}
      {testCases.length === 0 && (
        <div className="card bg-yellow-50 border-yellow-200 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-700">
              Create some test cases first before scheduling runs.
            </p>
          </div>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No scheduled runs
          </h3>
          <p className="text-gray-500 mb-4">
            Schedule test cases to run at specific times
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="card flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {getTestCaseName(schedule.testCaseId)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatScheduleTime(schedule)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  schedule.enabled 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {schedule.enabled ? 'Active' : 'Disabled'}
                </span>
                <button
                  onClick={() => deleteSchedule(schedule.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule Test Run</h2>
            <form onSubmit={createSchedule}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Case
                </label>
                <select
                  value={selectedTestCase}
                  onChange={(e) => setSelectedTestCase(e.target.value)}
                  className="input"
                >
                  <option value="">Select a test case</option>
                  {testCases.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.suiteName} / {tc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="once"
                      checked={scheduleType === 'once'}
                      onChange={(e) => setScheduleType(e.target.value)}
                      className="text-primary-600"
                    />
                    <span className="text-sm">One-time</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="recurring"
                      checked={scheduleType === 'recurring'}
                      onChange={(e) => setScheduleType(e.target.value)}
                      className="text-primary-600"
                    />
                    <span className="text-sm">Recurring</span>
                  </label>
                </div>
              </div>

              {scheduleType === 'once' ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Run At
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="input"
                  />
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="e.g., 0 9 * * 1-5"
                    className="input mb-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    {cronPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCronExpression(preset.value)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTestCase || (scheduleType === 'once' ? !scheduledTime : !cronExpression)}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

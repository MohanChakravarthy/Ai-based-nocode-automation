import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FolderKanban, 
  ChevronRight, 
  Trash2, 
  TestTube2,
  Search
} from 'lucide-react';

export default function Dashboard() {
  const [testSuites, setTestSuites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestSuites();
  }, []);

  const fetchTestSuites = async () => {
    try {
      const response = await fetch('/api/test-suites');
      const data = await response.json();
      setTestSuites(data);
    } catch (error) {
      console.error('Failed to fetch test suites:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTestSuite = async (e) => {
    e.preventDefault();
    if (!newSuiteName.trim()) return;

    try {
      const response = await fetch('/api/test-suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newSuiteName,
          description: newSuiteDescription 
        })
      });
      const newSuite = await response.json();
      setTestSuites([...testSuites, newSuite]);
      setNewSuiteName('');
      setNewSuiteDescription('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create test suite:', error);
    }
  };

  const deleteTestSuite = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this test suite?')) return;

    try {
      await fetch(`/api/test-suites/${id}`, { method: 'DELETE' });
      setTestSuites(testSuites.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete test suite:', error);
    }
  };

  const filteredSuites = testSuites.filter(suite =>
    suite.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Suites</h1>
          <p className="text-gray-500 mt-1">Manage your automation test suites</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          New Test Suite
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search test suites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-12"
        />
      </div>

      {/* Test Suites Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredSuites.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No matching test suites' : 'No test suites yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery 
              ? 'Try a different search term' 
              : 'Create your first test suite to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mx-auto"
            >
              <Plus className="w-5 h-5" />
              Create Test Suite
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuites.map((suite) => (
            <Link
              key={suite.id}
              to={`/suite/${suite.id}`}
              className="card hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {suite.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {suite.testCaseCount} test case{suite.testCaseCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteTestSuite(suite.id, e)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {suite.description && (
                <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                  {suite.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Created {new Date(suite.createdAt).toLocaleDateString()}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Test Suite</h2>
            <form onSubmit={createTestSuite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suite Name
                </label>
                <input
                  type="text"
                  value={newSuiteName}
                  onChange={(e) => setNewSuiteName(e.target.value)}
                  placeholder="e.g., E-commerce Tests"
                  className="input"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newSuiteDescription}
                  onChange={(e) => setNewSuiteDescription(e.target.value)}
                  placeholder="Describe what this test suite covers..."
                  className="input min-h-[100px] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSuiteName.trim()}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Suite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

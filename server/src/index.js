import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { AutomationEngine } from './automation/engine.js';
import { AIInterpreter } from './ai/interpreter.js';
import { JiraService } from './services/jira.js';
import { Scheduler } from './services/scheduler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6, // 50MB for screenshots
  transports: ['websocket', 'polling'],
  pingTimeout: 60000
});

app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static('public/screenshots'));

// In-memory storage (replace with database in production)
const storage = {
  testSuites: [],
  testCases: [],
  executionHistory: [],
  scheduledRuns: []
};

const automationEngine = new AutomationEngine(io, storage);
const aiInterpreter = new AIInterpreter();
const jiraService = new JiraService();
const scheduler = new Scheduler(storage, automationEngine, io);

// Test Suites API
app.get('/api/test-suites', (req, res) => {
  res.json(storage.testSuites);
});

app.post('/api/test-suites', (req, res) => {
  const suite = {
    id: uuidv4(),
    name: req.body.name,
    description: req.body.description || '',
    createdAt: new Date().toISOString(),
    testCaseCount: 0
  };
  storage.testSuites.push(suite);
  res.status(201).json(suite);
});

app.get('/api/test-suites/:id', (req, res) => {
  const suite = storage.testSuites.find(s => s.id === req.params.id);
  if (!suite) return res.status(404).json({ error: 'Suite not found' });
  res.json(suite);
});

app.delete('/api/test-suites/:id', (req, res) => {
  const index = storage.testSuites.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Suite not found' });
  storage.testSuites.splice(index, 1);
  storage.testCases = storage.testCases.filter(tc => tc.suiteId !== req.params.id);
  res.status(204).send();
});

// Test Cases API
app.get('/api/test-suites/:suiteId/test-cases', (req, res) => {
  const cases = storage.testCases.filter(tc => tc.suiteId === req.params.suiteId);
  res.json(cases);
});

app.post('/api/test-suites/:suiteId/test-cases', (req, res) => {
  const testCase = {
    id: uuidv4(),
    suiteId: req.params.suiteId,
    name: req.body.name,
    steps: req.body.steps || [],
    jiraTestCaseId: req.body.jiraTestCaseId || null,
    createdAt: new Date().toISOString(),
    lastRun: null,
    lastStatus: null
  };
  storage.testCases.push(testCase);
  
  // Update suite test case count
  const suite = storage.testSuites.find(s => s.id === req.params.suiteId);
  if (suite) suite.testCaseCount++;
  
  res.status(201).json(testCase);
});

app.put('/api/test-cases/:id', (req, res) => {
  const index = storage.testCases.findIndex(tc => tc.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Test case not found' });
  
  storage.testCases[index] = {
    ...storage.testCases[index],
    name: req.body.name,
    steps: req.body.steps,
    jiraTestCaseId: req.body.jiraTestCaseId
  };
  res.json(storage.testCases[index]);
});

app.delete('/api/test-cases/:id', (req, res) => {
  const testCase = storage.testCases.find(tc => tc.id === req.params.id);
  if (!testCase) return res.status(404).json({ error: 'Test case not found' });
  
  const index = storage.testCases.findIndex(tc => tc.id === req.params.id);
  storage.testCases.splice(index, 1);
  
  // Update suite test case count
  const suite = storage.testSuites.find(s => s.id === testCase.suiteId);
  if (suite) suite.testCaseCount--;
  
  res.status(204).send();
});

// Execute Test Case
app.post('/api/test-cases/:id/run', async (req, res) => {
  const testCase = storage.testCases.find(tc => tc.id === req.params.id);
  if (!testCase) return res.status(404).json({ error: 'Test case not found' });
  
  const executionId = uuidv4();
  res.json({ executionId, status: 'started' });
  
  // Run automation in background
  automationEngine.executeTestCase(executionId, testCase, aiInterpreter);
});

// AI Interpret Steps
app.post('/api/ai/interpret', async (req, res) => {
  try {
    const { naturalLanguageSteps } = req.body;
    const interpretedSteps = await aiInterpreter.interpretSteps(naturalLanguageSteps);
    res.json({ steps: interpretedSteps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Jira Integration
app.post('/api/jira/fetch-steps', async (req, res) => {
  try {
    const { testCaseId } = req.body;
    const steps = await jiraService.fetchTestCaseSteps(testCaseId);
    res.json({ steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scheduling API
app.get('/api/schedules', (req, res) => {
  res.json(storage.scheduledRuns);
});

app.post('/api/schedules', (req, res) => {
  const schedule = {
    id: uuidv4(),
    testCaseId: req.body.testCaseId,
    cronExpression: req.body.cronExpression,
    scheduledTime: req.body.scheduledTime,
    enabled: true,
    createdAt: new Date().toISOString()
  };
  storage.scheduledRuns.push(schedule);
  scheduler.addSchedule(schedule);
  res.status(201).json(schedule);
});

app.delete('/api/schedules/:id', (req, res) => {
  const index = storage.scheduledRuns.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Schedule not found' });
  scheduler.removeSchedule(req.params.id);
  storage.scheduledRuns.splice(index, 1);
  res.status(204).send();
});

// Execution History
app.get('/api/executions', (req, res) => {
  // Return executions without full screenshots for list view
  const executions = storage.executionHistory.slice(-50).reverse().map(exec => ({
    ...exec,
    stepResults: exec.stepResults?.map(step => ({
      ...step,
      screenshot: step.screenshot ? 'has_screenshot' : null
    }))
  }));
  res.json(executions);
});

// Get single execution with full details
app.get('/api/executions/:id', (req, res) => {
  const execution = storage.executionHistory.find(e => e.executionId === req.params.id);
  if (!execution) return res.status(404).json({ error: 'Execution not found' });
  res.json(execution);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { storage };

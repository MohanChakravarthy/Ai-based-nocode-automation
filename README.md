# AI-Powered Web Automation Tool

A modern, UI-based tool where an AI agent can automate web application tasks using simple natural language instructions or by fetching steps from a Jira Test Case ID.

![Dashboard](https://via.placeholder.com/800x400?text=AI+Web+Automation+Dashboard)

## Features

### Natural Language Test Execution
- Type test steps in plain English
- AI agent interprets and executes automation
- Example steps:
  ```
  1. Open browser
  2. Navigate to "flipkart.com"
  3. Search for the product called "mobiles"
  4. Select 4th product
  5. Add the product to the cart
  ```

### Jira Integration
- Enter a Jira Test Case ID
- Automatically fetch and execute test steps
- Supports Zephyr Scale and standard Jira issues

### Test Management UI
- **Dashboard**: List of test suites with option to create new ones
- **Test Suite Page**: Create and manage test cases
- **Test Case Editor**:
  - Enter test case name
  - Add steps using text boxes
  - "+" button to add new steps
  - Delete button to remove steps
  - Save and Run options

### Real-Time Execution View
- Live progress updates during test execution
- Step-by-step status indicators
- No page reload required
- Instant feedback via WebSocket

### Scheduling
- Schedule test cases for future execution
- Support for one-time and recurring (cron) schedules
- View and manage upcoming runs

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express + Socket.IO
- **Automation**: Playwright
- **AI**: OpenAI API (optional)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   cd AI-NoCode-WebAutomation
   ```

2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

3. Configure environment variables:
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here  # Optional - for AI interpretation
   JIRA_BASE_URL=https://your-domain.atlassian.net  # Optional
   JIRA_EMAIL=your-email@example.com  # Optional
   JIRA_API_TOKEN=your_jira_api_token  # Optional
   ```

4. Install Playwright browsers:
   ```bash
   cd server
   npx playwright install chromium
   ```

### Running the Application

Start both frontend and backend:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

Access the application at: http://localhost:5173

## Usage

### Creating a Test Suite
1. Click "New Test Suite" on the dashboard
2. Enter a name and optional description
3. Click "Create Suite"

### Creating a Test Case
1. Open a test suite
2. Click "New Test Case"
3. Enter a name for your test case
4. Add steps manually or use:
   - **AI Natural Language**: Paste your steps in plain English
   - **Import from Jira**: Enter a Jira Test Case ID

### Running a Test Case
1. Click the Play button on any test case
2. Watch real-time progress in the execution panel
3. View results in the History page

### Scheduling Tests
1. Go to the Schedules page
2. Click "Schedule Run"
3. Select a test case
4. Choose one-time or recurring schedule
5. Set the time/cron expression

## Demo Jira Test Cases

For testing without Jira integration, use these mock IDs:
- `TC-001`: Flipkart mobile search
- `TC-002`: Amazon laptop search
- `TC-003`: Google search

## Project Structure

```
AI-NoCode-WebAutomation/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React context (Socket)
│   │   ├── pages/          # Page components
│   │   └── App.jsx         # Main app component
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── automation/     # Playwright automation engine
│   │   ├── ai/             # AI step interpreter
│   │   ├── services/       # Jira & Scheduler services
│   │   └── index.js        # Express server
│   └── package.json
└── package.json            # Root package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/test-suites` | List all test suites |
| POST | `/api/test-suites` | Create a test suite |
| GET | `/api/test-suites/:id/test-cases` | List test cases in a suite |
| POST | `/api/test-suites/:id/test-cases` | Create a test case |
| PUT | `/api/test-cases/:id` | Update a test case |
| POST | `/api/test-cases/:id/run` | Run a test case |
| POST | `/api/ai/interpret` | Interpret natural language steps |
| POST | `/api/jira/fetch-steps` | Fetch steps from Jira |
| GET | `/api/schedules` | List scheduled runs |
| POST | `/api/schedules` | Create a schedule |

## License

MIT

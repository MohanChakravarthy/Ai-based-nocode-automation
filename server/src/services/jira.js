export class JiraService {
  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL;
    this.email = process.env.JIRA_EMAIL;
    this.apiToken = process.env.JIRA_API_TOKEN;
  }

  async fetchTestCaseSteps(testCaseId) {
    if (!this.baseUrl || !this.email || !this.apiToken) {
      // Return mock data for demo purposes
      return this.getMockTestCaseSteps(testCaseId);
    }

    try {
      const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      // Try Zephyr Scale API first (common test management tool)
      const response = await fetch(
        `${this.baseUrl}/rest/atm/1.0/testcase/${testCaseId}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        // Fallback to regular Jira issue
        return await this.fetchFromJiraIssue(testCaseId, auth);
      }

      const data = await response.json();
      
      // Extract steps from test case
      if (data.testScript && data.testScript.steps) {
        return data.testScript.steps.map(step => step.description || step.action);
      }

      return [];
    } catch (error) {
      console.error('Jira fetch error:', error);
      return this.getMockTestCaseSteps(testCaseId);
    }
  }

  async fetchFromJiraIssue(issueKey, auth) {
    try {
      const response = await fetch(
        `${this.baseUrl}/rest/api/3/issue/${issueKey}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Issue not found');
      }

      const data = await response.json();
      
      // Try to extract steps from description
      const description = data.fields.description;
      if (description) {
        // Parse description for numbered steps
        const content = typeof description === 'string' 
          ? description 
          : this.extractTextFromADF(description);
        
        const steps = content
          .split(/[\n\r]+/)
          .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
        
        return steps;
      }

      return [];
    } catch (error) {
      console.error('Jira issue fetch error:', error);
      return this.getMockTestCaseSteps(issueKey);
    }
  }

  extractTextFromADF(adfContent) {
    // Extract text from Atlassian Document Format
    if (!adfContent || !adfContent.content) return '';
    
    const extractText = (node) => {
      if (node.type === 'text') return node.text || '';
      if (node.content) return node.content.map(extractText).join('\n');
      return '';
    };

    return adfContent.content.map(extractText).join('\n');
  }

  getMockTestCaseSteps(testCaseId) {
    // Mock data for demonstration
    const mockTestCases = {
      'TC-001': [
        'Open browser',
        'Navigate to "flipkart.com"',
        'Search for "mobiles"',
        'Select 1st product',
        'Add the product to the cart'
      ],
      'TC-002': [
        'Open browser',
        'Navigate to "amazon.in"',
        'Search for "laptops"',
        'Select 2nd product',
        'Add the product to the cart'
      ],
      'TC-003': [
        'Open browser',
        'Navigate to "google.com"',
        'Search for "playwright automation"',
        'Click on first result'
      ]
    };

    return mockTestCases[testCaseId] || [
      'Open browser',
      `Navigate to "example.com"`,
      `Verify page loaded for ${testCaseId}`
    ];
  }
}

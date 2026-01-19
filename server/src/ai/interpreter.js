import OpenAI from 'openai';

export class AIInterpreter {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  // AI-powered element finder - analyzes page and finds the right element
  async findElementForAction(page, actionDescription) {
    // Get page content for analysis
    const pageInfo = await page.evaluate(() => {
      const getElementInfo = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: el.className || null,
          text: el.innerText?.slice(0, 100) || null,
          placeholder: el.placeholder || null,
          name: el.name || null,
          type: el.type || null,
          href: el.href || null,
          ariaLabel: el.getAttribute('aria-label') || null,
          role: el.getAttribute('role') || null,
          value: el.value || null
        };
      };

      // Get interactive elements
      const interactiveElements = [];
      const selectors = 'a, button, input, textarea, select, [onclick], [role="button"], [role="link"], [tabindex]';
      document.querySelectorAll(selectors).forEach((el, i) => {
        const info = getElementInfo(el);
        if (info && i < 50) { // Limit to 50 elements
          info.index = i;
          interactiveElements.push(info);
        }
      });

      return {
        url: window.location.href,
        title: document.title,
        elements: interactiveElements
      };
    });

    // If no OpenAI, use smart matching
    if (!this.openai) {
      return this.smartMatch(pageInfo.elements, actionDescription);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a web automation assistant. Given a list of page elements and an action to perform, identify the best element to interact with.
            
            Return a JSON object with:
            - selector: The best CSS selector to find this element (use id, class, or attribute selectors)
            - confidence: How confident you are (high/medium/low)
            - reason: Brief explanation
            
            Prefer selectors in this order: #id, [name=""], [placeholder=""], .class, text content`
          },
          {
            role: 'user',
            content: `Page: ${pageInfo.title} (${pageInfo.url})
            
Action to perform: ${actionDescription}

Available elements:
${JSON.stringify(pageInfo.elements.slice(0, 30), null, 2)}

Which element should I interact with?`
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      });

      const content = response.choices[0].message.content;
      try {
        return JSON.parse(content);
      } catch {
        return { selector: null, confidence: 'low', reason: content };
      }
    } catch (error) {
      console.error('AI element finder error:', error);
      return this.smartMatch(pageInfo.elements, actionDescription);
    }
  }

  // Smart matching without AI
  smartMatch(elements, actionDescription) {
    const action = actionDescription.toLowerCase();
    
    // Extract keywords from action
    const keywords = action.split(/\s+/).filter(w => w.length > 2);
    
    let bestMatch = null;
    let bestScore = 0;

    for (const el of elements) {
      let score = 0;
      const elText = [el.text, el.placeholder, el.ariaLabel, el.name, el.id, el.classes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // Check for keyword matches
      for (const keyword of keywords) {
        if (elText.includes(keyword)) score += 10;
      }

      // Boost for specific element types based on action
      if (action.includes('click') || action.includes('button') || action.includes('submit')) {
        if (el.tag === 'button') score += 5;
        if (el.type === 'submit') score += 5;
      }
      if (action.includes('type') || action.includes('enter') || action.includes('input') || action.includes('search')) {
        if (el.tag === 'input' || el.tag === 'textarea') score += 5;
        if (el.type === 'text' || el.type === 'search') score += 3;
      }
      if (action.includes('link') || action.includes('navigate')) {
        if (el.tag === 'a') score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    if (bestMatch) {
      // Build selector
      let selector = null;
      if (bestMatch.id) selector = `#${bestMatch.id}`;
      else if (bestMatch.name) selector = `[name="${bestMatch.name}"]`;
      else if (bestMatch.placeholder) selector = `[placeholder="${bestMatch.placeholder}"]`;
      else if (bestMatch.ariaLabel) selector = `[aria-label="${bestMatch.ariaLabel}"]`;
      else if (bestMatch.text) selector = `text="${bestMatch.text.slice(0, 50)}"`;
      
      return { selector, confidence: bestScore > 15 ? 'high' : 'medium', element: bestMatch };
    }

    return { selector: null, confidence: 'low', reason: 'No matching element found' };
  }

  async interpretSteps(naturalLanguageSteps) {
    // If no OpenAI key, use pattern-based interpretation
    if (!this.openai) {
      return this.patternBasedInterpretation(naturalLanguageSteps);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a test automation assistant. Convert natural language test steps into structured automation commands.
            
            For each step, identify:
            1. The action type (navigate, click, type, search, select, wait, scroll, etc.)
            2. The target element or URL
            3. Any values to input
            
            Return a JSON array of step objects with clear, executable descriptions.
            Keep the original natural language but make it more precise if needed.`
          },
          {
            role: 'user',
            content: `Convert these test steps into automation-ready format:\n${naturalLanguageSteps}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      
      // Try to parse as JSON, otherwise return as-is
      try {
        return JSON.parse(content);
      } catch {
        // Split by newlines and clean up
        return content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      }
    } catch (error) {
      console.error('AI interpretation error:', error);
      return this.patternBasedInterpretation(naturalLanguageSteps);
    }
  }

  async interpretSingleStep(step) {
    if (!this.openai) {
      return { action: step };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a web automation assistant. Given a test step description, provide the most likely Playwright action to perform.
            
            Return a JSON object with:
            - action: the simplified action description
            - selector: CSS selector or text to find the element (if applicable)
            - value: any value to input (if applicable)`
          },
          {
            role: 'user',
            content: step
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      });

      const content = response.choices[0].message.content;
      try {
        return JSON.parse(content);
      } catch {
        return { action: content };
      }
    } catch (error) {
      console.error('AI step interpretation error:', error);
      return { action: step };
    }
  }

  patternBasedInterpretation(naturalLanguageSteps) {
    // Split by newlines or numbered list
    const lines = naturalLanguageSteps
      .split(/[\n\r]+/)
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0);

    return lines.map(line => {
      // Clean up common phrases
      let cleaned = line
        .replace(/^(then\s+)?/i, '')
        .replace(/^(and\s+)?/i, '')
        .replace(/^(next\s+)?/i, '')
        .trim();

      // Standardize common actions
      if (/^open\s+(?:the\s+)?browser/i.test(cleaned)) {
        return 'Open browser';
      }
      
      if (/^(?:go\s+to|navigate\s+to|open)\s+/i.test(cleaned)) {
        const url = cleaned.replace(/^(?:go\s+to|navigate\s+to|open)\s+["']?/i, '').replace(/["']?$/, '');
        return `Navigate to "${url}"`;
      }
      
      if (/^search\s+/i.test(cleaned)) {
        const term = cleaned.replace(/^search\s+(?:for\s+)?(?:the\s+)?(?:product\s+)?(?:called\s+)?["']?/i, '').replace(/["']?$/, '');
        return `Search for "${term}"`;
      }
      
      if (/select.*product/i.test(cleaned)) {
        const match = cleaned.match(/(\d+)(?:st|nd|rd|th)/i);
        const index = match ? match[1] : '1';
        return `Select ${index}${this.getOrdinalSuffix(parseInt(index))} product`;
      }
      
      if (/add.*cart/i.test(cleaned)) {
        return 'Add the product to the cart';
      }

      return cleaned;
    });
  }

  getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
}

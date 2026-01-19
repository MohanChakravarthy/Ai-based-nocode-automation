// Screencast module for real-time browser streaming
import { chromium } from 'playwright';

export class ScreencastManager {
  constructor(io) {
    this.io = io;
    this.activeSessions = new Map();
  }

  async startScreencast(executionId, page) {
    try {
      // Get CDP session from the page
      const cdpSession = await page.context().newCDPSession(page);
      
      // Start screencast - sends frames as base64 images
      await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 2 // Send every 2nd frame for performance
      });

      // Listen for screencast frames
      cdpSession.on('Page.screencastFrame', async (event) => {
        const { data, sessionId } = event;
        
        // Emit frame to connected clients
        this.io.emit('screencast-frame', {
          executionId,
          frame: data, // base64 encoded image
          timestamp: Date.now()
        });

        // Acknowledge the frame to continue receiving
        await cdpSession.send('Page.screencastFrameAck', { sessionId });
      });

      this.activeSessions.set(executionId, cdpSession);
      console.log(`Screencast started for execution: ${executionId}`);
      
      return cdpSession;
    } catch (error) {
      console.error('Failed to start screencast:', error.message);
      return null;
    }
  }

  async stopScreencast(executionId) {
    const cdpSession = this.activeSessions.get(executionId);
    if (cdpSession) {
      try {
        await cdpSession.send('Page.stopScreencast');
        await cdpSession.detach();
      } catch (e) {
        // Session might already be closed
      }
      this.activeSessions.delete(executionId);
      console.log(`Screencast stopped for execution: ${executionId}`);
    }
  }
}

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Create a screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Serve screenshots directory
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Endpoint to get list of all screenshots
app.get('/api/screenshots', (req, res) => {
  try {
    if (!fs.existsSync(screenshotsDir)) {
      return res.json({
        success: false,
        message: 'Screenshots directory does not exist',
        screenshots: []
      });
    }
    
    // Get optional limit from query parameters
    const limit = parseInt(req.query.limit, 10) || 0; // 0 means no limit
    
    const screenshots = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        return {
          filename: file,
          path: `/screenshots/${file}`,
          url: `${baseUrl}/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // Sort by creation time, newest first
    
    const limitedScreenshots = limit > 0 ? screenshots.slice(0, limit) : screenshots;
    
    res.json({
      success: true,
      count: screenshots.length,
      screenshots: limitedScreenshots
    });
  } catch (error) {
    console.error('Error retrieving screenshots list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve screenshots list',
      error: error.message
    });
  }
});

/**
 * Main screenshot API endpoint
 * Simply passes through all query parameters to the client application at localhost:3000
 * and takes a screenshot of the rendered result
 */
app.get('/api/screenshot', async (req, res) => {
  try {
    // Get the original query string
    const queryString = req._parsedUrl.search || '';
    
    // Build the target URL with isScreenshot parameter
    let targetUrl = `http://localhost:3000/`;
    if (queryString) {
      // Add isScreenshot=true to the existing query parameters
      targetUrl += queryString + (queryString.includes('?') ? '&' : '?') + 'isScreenshot=true';
    } else {
      // No existing parameters, just add isScreenshot
      targetUrl += '?isScreenshot=true';
    }
    
    console.log(`Taking screenshot of: ${targetUrl}`);
    
    // Get width and height from query or use defaults
    const width = 3000;
    const height = 3000;
    const waitTime = parseInt(req.query.wait, 10) || 1000; // Time to wait for the app to render
    
    // Launch a headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width, height });
    
    // Navigate to the application URL with all query parameters
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    
    // Wait additional time for the application to fully render
    console.log(`Waiting ${waitTime}ms for the application to render...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Take the screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });
    
    // Close the browser
    await browser.close();
    
    // Save the screenshot to the screenshots directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `app-${timestamp}-${uuidv4()}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);
    fs.writeFileSync(screenshotPath, screenshot);
    
    // Get the server's base URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imagePath = `/screenshots/${filename}`;
    const imageUrl = `${baseUrl}${imagePath}`;
    
    console.log(`Screenshot saved: ${filename}`);
    console.log(`Image URL: ${imageUrl}`);
    
    // Instead of sending the screenshot directly, return a JSON with the path
    res.json({
      success: true,
      message: 'Screenshot generated successfully',
      filename: filename,
      path: imagePath,
      url: imageUrl,
      originalUrl: targetUrl,
      dimensions: {
        width: width,
        height: height
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating screenshot:', error);
    
    // Create a more detailed error response
    let errorDetails = {
      error: 'Failed to generate screenshot',
      message: error.message,
      possibleCauses: [
        'The client application at localhost:3000 is not running',
        'Invalid URL or query parameters',
        'The application failed to render properly'
      ],
      suggestions: [
        'Ensure the client application is running on localhost:3000',
        'Check the URL parameters for correctness',
        'Try increasing the wait time using the wait parameter (e.g., ?wait=5000)'
      ]
    };
    
    // Check for specific error types
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      errorDetails.primaryCause = 'Connection refused - The client application is not running';
    } else if (error.message.includes('Navigation timeout')) {
      errorDetails.primaryCause = 'Navigation timeout - The page took too long to load';
    } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      errorDetails.primaryCause = 'DNS resolution failed - Check your network connection';
    }
    
    res.status(500).json(errorDetails);
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  let screenshotFiles = [];
  
  if (fs.existsSync(screenshotsDir)) {
    screenshotFiles = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        return {
          filename: file,
          path: `/screenshots/${file}`,
          url: `${baseUrl}/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // Sort by creation time, newest first
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    screenshots_dir: screenshotsDir,
    screenshots_count: screenshotFiles.length,
    recent_screenshots: screenshotFiles.slice(0, 10) // Return the 10 most recent screenshots
  });
});

// Start the server with automatic port selection
const startServer = (port) => {
  const server = app.listen(port)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error('Server error:', err);
      }
    })
    .on('listening', () => {
      const actualPort = server.address().port;
    });
};

startServer(PORT); 
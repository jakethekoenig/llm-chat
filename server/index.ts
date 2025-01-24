import app from './app'

const PORT = process.env.PORT || 3000;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error({
    timestamp: new Date().toISOString(),
    event: 'uncaught_exception',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
  // Give the server time to finish any pending requests before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error({
    timestamp: new Date().toISOString(),
    event: 'unhandled_rejection',
    error: reason,
    promise: promise
  });
});

const server = app.listen(PORT, () => {
  console.info({
    timestamp: new Date().toISOString(),
    event: 'server_start',
    port: PORT
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.info({
    timestamp: new Date().toISOString(),
    event: 'server_shutdown',
    reason: 'SIGTERM'
  });
  server.close(() => {
    process.exit(0);
  });
});

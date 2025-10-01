/**
 * Simple logging utility for Lambda functions
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Create a log entry with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(args.length > 0 && { data: args }),
  };

  console.log(JSON.stringify(logEntry));
};

/**
 * Log error message
 */
const error = (message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    log('ERROR', message, ...args);
  }
};

/**
 * Log warning message
 */
const warn = (message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    log('WARN', message, ...args);
  }
};

/**
 * Log info message
 */
const info = (message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    log('INFO', message, ...args);
  }
};

/**
 * Log debug message
 */
const debug = (message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    log('DEBUG', message, ...args);
  }
};

module.exports = {
  error,
  warn,
  info,
  debug,
};

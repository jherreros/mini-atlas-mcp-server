import winston from 'winston';

const getLogLevel = (): 'info' | 'debug' | 'warn' | 'error' => {
  const level = process.env['LOG_LEVEL']?.toLowerCase();
  if (['info', 'debug', 'warn', 'error'].includes(level || '')) {
    return level as 'info' | 'debug' | 'warn' | 'error';
  }
  return 'info';
};

export const logger = winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;
      const duration = Date.now() - startTime;
      
      const message = `[${method}] ${originalUrl} - Status: ${statusCode} - Size: ${contentLength}b - Duration: ${duration}ms - IP: ${ip}`;
      
      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }

      // Detailed debug logs for payloads
      if (Object.keys(request.query).length > 0) {
        this.logger.debug(`🔍 Query: ${JSON.stringify(request.query)}`);
      }
      if (request.body && Object.keys(request.body).length > 0) {
        // Create a copy and obfuscate passwords
        const bodyToLog = { ...request.body };
        if (bodyToLog.password) bodyToLog.password = '***';
        if (bodyToLog.passwordHash) bodyToLog.passwordHash = '***';
        this.logger.debug(`📦 Body: ${JSON.stringify(bodyToLog)}`);
      }
    });

    next();
  }
}

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/schema';

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (typeof apiKeyHeader === 'string') {
    token = apiKeyHeader;
  }

  if (!token || token !== config.agentApiKey) {
    res.status(401).json({
      error: 'Unauthorized Access',
      message: 'Invalid or missing API key token.'
    });
    return;
  }

  next();
};

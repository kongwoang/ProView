import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const databaseStatus =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? ({ P2002: 409, P2003: 409, P2025: 404, P2034: 409 } as Record<string, number>)[error.code]
        : undefined;
    const status = error instanceof HttpException ? error.getStatus() : (databaseStatus ?? 500);
    const raw =
      error instanceof HttpException
        ? error.getResponse()
        : databaseStatus
          ? {
              code: databaseStatus === 404 ? 'RESOURCE_NOT_FOUND' : 'DATA_CONFLICT',
              message:
                databaseStatus === 404
                  ? 'Resource not found'
                  : 'Data changed or conflicts with an existing record; reload and retry',
            }
          : undefined;
    const details = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const requestId = response.getHeader('x-request-id');
    if (status >= 500)
      this.logger.error({
        event: 'request_failed',
        requestId,
        method: request.method,
        path: request.path,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    const message =
      status >= 500
        ? 'An internal error occurred'
        : (details.message ?? (typeof raw === 'string' ? raw : 'Request rejected'));
    response.status(status).json({
      code: typeof details.code === 'string' ? details.code : `HTTP_${status}`,
      message: Array.isArray(message) ? 'Request validation failed' : message,
      ...(Array.isArray(message) ? { fieldErrors: message } : {}),
      ...(details.fieldErrors ? { fieldErrors: details.fieldErrors } : {}),
      requestId,
    });
  }
}

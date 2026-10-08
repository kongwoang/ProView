import { applyDecorators } from '@nestjs/common';
import { ApiProduces, ApiResponse } from '@nestjs/swagger';

export const ApiPdfResponse = (range = true) =>
  applyDecorators(
    ApiProduces('application/pdf'),
    ApiResponse({
      status: 200,
      description: 'Authorized private PDF bytes; storage keys/URLs are never returned.',
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
    }),
    ...(range
      ? [
          ApiResponse({
            status: 206,
            description: 'Authorized PDF byte range (Content-Range header).',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          }),
          ApiResponse({
            status: 416,
            description: 'Unsatisfiable byte range; empty response body.',
          }),
        ]
      : []),
  );

import { APIGatewayProxyResult } from 'aws-lambda';

export function createResponse(
  statusCode: number,
  body: any,
  headers: { [key: string]: string } = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function createErrorResponse(
  statusCode: number,
  message: string,
  details?: any
): APIGatewayProxyResult {
  const errorBody = {
    error: {
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };

  return createResponse(statusCode, errorBody);
}

export function createSuccessResponse(data: any): APIGatewayProxyResult {
  return createResponse(200, {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

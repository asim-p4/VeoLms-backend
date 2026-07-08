export function ApiResponse(
  statusCode: number,
  message: string,
  data: unknown = null,
  errors: unknown[] | null = null,
) {
  return {
    success: statusCode < 400,
    message,
    data,
    errors,
  };
}

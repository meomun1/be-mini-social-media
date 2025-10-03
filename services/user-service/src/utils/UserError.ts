export class UserError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'UserError';
    this.code = code;
    this.details = details;
  }
}

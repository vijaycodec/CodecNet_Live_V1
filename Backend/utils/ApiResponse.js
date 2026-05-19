export class ApiResponse {
  constructor(statusCode, data, message = "Success", errors = null) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;

    // Include validation errors if provided
    if (errors && Array.isArray(errors) && errors.length > 0) {
      this.errors = errors;
    }
  }
}
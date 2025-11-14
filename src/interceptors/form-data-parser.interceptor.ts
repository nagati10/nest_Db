// interceptors/form-data-parser.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class FormDataParserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Parse tags from string to array if it's a string
    if (request.body.tags && typeof request.body.tags === 'string') {
      try {
        request.body.tags = JSON.parse(request.body.tags);
      } catch (e) {
        // If it's a comma-separated string, split it
        if (request.body.tags.includes(',')) {
          request.body.tags = request.body.tags.split(',').map(tag => tag.trim());
        } else {
          request.body.tags = [request.body.tags];
        }
      }
    }

    // Parse location from string to object if it's a string
    if (request.body.location && typeof request.body.location === 'string') {
      try {
        request.body.location = JSON.parse(request.body.location);
      } catch (e) {
        // If parsing fails, keep it as is (will be validated by DTO)
      }
    }

    return next.handle().pipe(
      map(data => data)
    );
  }
}
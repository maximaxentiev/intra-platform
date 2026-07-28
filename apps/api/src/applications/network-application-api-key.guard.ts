import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { safeCompareSecret } from './network-submit.util';

@Injectable()
export class NetworkApplicationApiKeyGuard implements CanActivate {
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('NETWORK_APPLICATION_API_KEY');
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Network application submissions are not configured.',
      );
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const provided = match?.[1]?.trim() ?? '';

    if (!provided || !safeCompareSecret(provided, this.apiKey)) {
      throw new UnauthorizedException('Invalid or missing API key.');
    }

    return true;
  }
}

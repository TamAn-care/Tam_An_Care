import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import {
  AuthService,
} from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body()
    body: {
      actorId?: string;
      password?: string;
    },
  ) {
    return this.authService.login(
      String(body.actorId || ''),
      String(body.password || ''),
    );
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-auth-session-id')
    sessionId?: string,
  ): Promise<void> {
    if (!actorId || !sessionId) {
      throw new UnauthorizedException(
        'Authentication session is required',
      );
    }

    await this.authService.revokeSession(
      actorId,
      sessionId,
    );
  }
}

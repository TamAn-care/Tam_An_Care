import {
  Body,
  Controller,
  HttpCode,
  Post,
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
}

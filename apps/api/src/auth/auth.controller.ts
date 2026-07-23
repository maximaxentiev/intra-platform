import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { Public } from './session.guard';
import type { SessionPayload } from './session.service';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.cookieName = config.getOrThrow<string>('SESSION_COOKIE_NAME');
    this.secure = config.getOrThrow<boolean>('SESSION_COOKIE_SECURE');
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: this.sessions.ttlSeconds * 1000,
    };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { sid, user } = await this.auth.login(dto.email, dto.password);
    res.cookie(this.cookieName, sid, this.cookieOptions());
    return this.users.getProfile(user.userId);
  }

  @Post('logout')
  async logout(@Req() req: Request & { sessionId?: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.sessionId ?? '');
    res.clearCookie(this.cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('session')
  session(@CurrentUser() user: SessionPayload) {
    return this.users.getProfile(user.userId);
  }

  @Post('change-password')
  async changePassword(@CurrentUser() user: SessionPayload, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}

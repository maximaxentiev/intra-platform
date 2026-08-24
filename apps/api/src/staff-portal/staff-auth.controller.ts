import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/session.guard';
import { resolveClientIp } from '../common/client-ip.util';
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  StaffLoginDto,
} from './dto/staff-auth.dto';
import { StaffAuthService } from './staff-auth.service';
import { StaffPasswordResetService } from './staff-password-reset.service';
import { CurrentStaff, StaffSessionGuard } from './staff-session.guard';
import { StaffSessionService, type StaffSessionPayload } from './staff-session.service';

/**
 * Independent-carer authentication. Marked @Public() so the global ops session
 * guard steps aside; the staff session guard protects the routes that need it.
 */
@Public()
@UseGuards(CarerPortalEnabledGuard)
@ApiTags('staff-portal')
@Controller('staff-auth')
export class StaffAuthController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly passwordReset: StaffPasswordResetService,
    private readonly sessions: StaffSessionService,
  ) {}

  @Post('login')
  async login(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const { sid, payload } = await this.auth.login(dto.email, dto.password);
    res.cookie(
      this.sessions.cookieName,
      sid,
      this.sessions.cookieOptions(this.sessions.ttlSeconds * 1000),
    );
    return this.auth.me(payload);
  }

  @Get('invite/:token')
  invite(@Param('token') token: string) {
    return this.auth.describeInvite(token);
  }

  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const { sid, payload } = await this.auth.acceptInvite(dto.token, dto.password);
    res.cookie(
      this.sessions.cookieName,
      sid,
      this.sessions.cookieOptions(this.sessions.ttlSeconds * 1000),
    );
    return this.auth.me(payload);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    await this.passwordReset.requestPasswordReset(dto.email, resolveClientIp(req));
    return { ok: true };
  }

  @Get('reset-password/:token')
  validateResetPassword(@Param('token') token: string, @Req() req: Request) {
    return this.passwordReset.validateResetToken(token, resolveClientIp(req));
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.passwordReset.resetPassword(dto.token, dto.password, resolveClientIp(req));
    return { ok: true };
  }

  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[this.sessions.cookieName] ?? '');
    res.clearCookie(this.sessions.cookieName, this.sessions.cookieOptions());
    return { ok: true };
  }

  @UseGuards(StaffSessionGuard)
  @Get('session')
  session(@CurrentStaff() staff: StaffSessionPayload) {
    return this.auth.me(staff);
  }
}

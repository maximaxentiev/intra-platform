import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import type { SessionPayload } from '../auth/session.service';
import { InviteUserDto, UpdateProfileDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Current ops user's own profile (self only).
  @Get('me')
  me(@CurrentUser() user: SessionPayload) {
    return this.users.getProfile(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: SessionPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto.fullName ?? '');
  }

  // Admin-only user administration (invite-only model).
  @Roles('admin')
  @Get('users')
  list() {
    return this.users.list();
  }

  @Roles('admin')
  @Post('users')
  invite(@Body() dto: InviteUserDto) {
    return this.users.invite(dto);
  }

  @Roles('admin')
  @Patch('users/:id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}

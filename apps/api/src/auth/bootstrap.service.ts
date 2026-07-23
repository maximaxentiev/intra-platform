import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

/**
 * On an empty database, provision the first admin from env so the invite-only
 * model has a starting point. No-op once any user exists.
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger('Bootstrap');

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');
    const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD');
    const name = this.config.get<string>('BOOTSTRAP_ADMIN_NAME') ?? 'Ops Admin';
    if (!email || !password) return;

    const count = await this.users.count();
    if (count > 0) return;

    try {
      await this.users.invite({ email, password, fullName: name, role: 'admin' });
      this.logger.log(`Bootstrapped initial admin: ${email}`);
    } catch (err) {
      this.logger.error(`Failed to bootstrap admin: ${(err as Error).message}`);
    }
  }
}

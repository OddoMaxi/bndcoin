import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';

/** Makes the /mock/* endpoints invisible unless MOCK_PROVIDERS_ENABLED is on. */
@Injectable()
export class MockEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(): boolean {
    if (!this.config.providers.mockEnabled) {
      throw new NotFoundException('Cannot POST to this route');
    }
    return true;
  }
}

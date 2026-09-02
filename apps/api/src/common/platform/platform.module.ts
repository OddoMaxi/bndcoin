import { Global, Module } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsService } from '../alerts/alerts.service';
import { SettingsService } from '../settings/settings.service';

@Global()
@Module({
  providers: [NotificationsService, AlertsService, SettingsService],
  exports: [NotificationsService, AlertsService, SettingsService],
})
export class PlatformModule {}

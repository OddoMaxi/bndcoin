import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  controllers: [UsersController, KycController],
  providers: [UsersService, KycService],
  exports: [UsersService, KycService],
})
export class UsersModule {}

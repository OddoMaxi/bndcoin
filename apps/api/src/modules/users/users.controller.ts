import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/rbac/decorators';
import { AdminUpdateUserDto, ListUsersQuery, UpdateMeDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users/me')
  me(@CurrentUser('id') id: string) {
    return this.users.getById(id);
  }

  @Patch('users/me')
  updateMe(@CurrentUser('id') id: string, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(id, dto);
  }

  @Get('users/me/limits')
  limits(@CurrentUser('id') id: string) {
    return this.users.getLimits(id);
  }

  @Roles('ADMIN', 'COMPLIANCE')
  @Get('admin/users')
  adminList(@Query() q: ListUsersQuery) {
    return this.users.adminList(q);
  }

  @Roles('ADMIN', 'COMPLIANCE')
  @Get('admin/users/:id')
  adminGet(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Roles('ADMIN')
  @Patch('admin/users/:id')
  adminUpdate(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.adminUpdate(actorId, id, dto);
  }
}

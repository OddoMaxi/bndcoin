import { User } from '@prisma/client';
import { UserDto } from '@bn/shared-types';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    kycLevel: user.kycLevel,
    createdAt: user.createdAt.toISOString(),
  };
}

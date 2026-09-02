import { User } from '@prisma/client';

export function toUserDto(user: User) {
  return {
    id: user.id,
    publicUserId: user.publicUserId,
    phone: user.phone,
    email: user.email,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    country: user.country,
    address: user.address,
    role: user.role,
    status: user.status,
    kycLevel: user.kycLevel,
    kycStatus: user.kycStatus,
    riskLevel: user.riskLevel,
    createdAt: user.createdAt.toISOString(),
  };
}

import { ForbiddenException, Injectable } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { SearchUsersDto } from '././dtos/search-users.dto'
import { VerifyUserDto } from '././dtos/verify-user.dto'

@Injectable()
export class OrganizersVerificationService {
	constructor(private prisma: PrismaService) {}

	async verifyUser(data: VerifyUserDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: data.userId }
		})
		if (!user) throw new ForbiddenException('User not found')

		return this.prisma.user.update({
			where: { id: data.userId },
			data: { isVerified: data.isVerified }
		})
	}

	async searchUsers(params: SearchUsersDto) {
		const where: any = {}

		if (params.email) where.email = { contains: params.email }
		if (params.username) where.username = { contains: params.username }
		if (typeof params.isVerified !== 'undefined') {
			where.isVerified = params.isVerified
		}

		return this.prisma.user.findMany({
			where,
			skip: params.skip,
			take: params.take,
			orderBy: { createdAt: 'desc' }
		})
	}
}

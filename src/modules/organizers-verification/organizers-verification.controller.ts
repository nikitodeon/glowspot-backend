import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Post,
	Query,
	UseGuards
} from '@nestjs/common'

import { User } from '@/prisma/generated'
import { Authorized } from '@/src/shared/decorators/http-authorized.decorator'
import { HttpSessionGuard } from '@/src/shared/guards/http-session.guard'

import { OrganizersVerificationService } from './organizers-verification.service'

@Controller('api/organizers/verification')
@UseGuards(HttpSessionGuard)
export class OrganizersVerificationController {
	constructor(private service: OrganizersVerificationService) {}

	@Post()
	async verifyUser(
		@Body() body: { userId: string; isVerified: boolean },
		@Authorized() user: User
	) {
		if (!user.isAdmin) throw new ForbiddenException('Only for admins!')
		return this.service.verifyUser({
			userId: body.userId,
			isVerified: body.isVerified
		})
	}

	@Get('users')
	async searchUsers(
		@Query('email') email?: string,
		@Query('username') username?: string,
		@Query('isVerified') isVerified?: string,
		@Query('skip') skip?: string,
		@Query('take') take?: string,
		@Authorized() user?: User
	) {
		if (!user?.isAdmin) throw new ForbiddenException('Only for admins!')

		return this.service.searchUsers({
			email,
			username,
			isVerified: isVerified ? isVerified === 'true' : undefined,
			skip: skip ? parseInt(skip) : 0,
			take: take ? parseInt(take) : 10
		})
	}
}

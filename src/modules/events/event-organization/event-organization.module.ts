import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { EventOrganizationResolver } from './event-organization.resolver'
import { EventOrganizationService } from './event-organization.service'

@Module({
	providers: [
		EventOrganizationService,
		EventOrganizationResolver,
		PrismaService
	]
})
export class EventOrganizationModule {}

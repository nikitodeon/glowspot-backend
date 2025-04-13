import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { EventParticipationResolver } from './event-participation.resolver'
import { EventParticipationService } from './event-participation.service'

@Module({
	providers: [
		EventParticipationResolver,
		EventParticipationService,
		PrismaService
	]
})
export class EventParticipationModule {}

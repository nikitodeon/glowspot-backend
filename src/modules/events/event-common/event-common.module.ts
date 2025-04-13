import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { EventCommonResolver } from './event-common.resolver'
import { EventCommonService } from './event-common.service'

@Module({
	providers: [EventCommonService, EventCommonResolver, PrismaService]
})
export class EventCommonModule {}

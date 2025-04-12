import { Module } from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

import { OrganizersVerificationController } from './organizers-verification.controller'
import { OrganizersVerificationService } from './organizers-verification.service'

@Module({
	controllers: [OrganizersVerificationController],
	providers: [OrganizersVerificationService, PrismaService]
})
export class OrganizersVerificationModule {}

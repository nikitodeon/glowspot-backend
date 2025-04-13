import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { User } from '@prisma/generated'

import { Authorization } from '@/src/shared/decorators/auth.decorator'
import { Authorized } from '@/src/shared/decorators/authorized.decorator'
import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventModel } from '../event-common/models/event.model'

import { EventParticipationService } from './event-participation.service'

@Resolver(() => EventModel)
export class EventParticipationResolver {
	constructor(
		private readonly eventsParticipationService: EventParticipationService
	) {}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async participateInEvent(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	) {
		return this.eventsParticipationService.participateInEvent(
			eventId,
			user.id
		)
	}

	@Authorization()
	@Mutation(() => Boolean)
	@UseGuards(GqlAuthGuard)
	async leaveEvent(
		@Args('eventId') eventId: string,
		@Authorized() user: User
	) {
		return this.eventsParticipationService.leaveEvent(eventId, user.id)
	}
	@Authorization()
	@Query(() => [EventModel], { name: 'getEventsWhereIParticipate' })
	@UseGuards(GqlAuthGuard)
	async getEventsWhereIParticipate(@Authorized() user: User) {
		return this.eventsParticipationService.getEventsWhereIParticipate(
			user.id
		)
	}
}

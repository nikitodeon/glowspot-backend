import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'

import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventCommonService } from './event-common.service'
import { EventFilterInput } from './inputs/event-filter.input'
import { EventModel } from './models/event.model'

@Resolver(() => EventModel)
export class EventCommonResolver {
	constructor(private readonly eventsCommonService: EventCommonService) {}

	@Query(() => [EventModel], { name: 'getAllEvents' })
	@UseGuards(GqlAuthGuard)
	async getAllEvents(
		@Args('filter', { type: () => EventFilterInput, nullable: true })
		filter?: EventFilterInput
	) {
		return this.eventsCommonService.getAllEvents(filter)
	}

	@Query(() => EventModel, { name: 'getEventById' })
	async getEventById(@Args('id') id: string) {
		return this.eventsCommonService.getEventById(id)
	}
}

import { UseGuards } from '@nestjs/common'
import {
	Args,
	Mutation,
	Parent,
	Query,
	ResolveField,
	Resolver
} from '@nestjs/graphql'
import { User } from '@prisma/generated'

import { Authorization } from '@/src/shared/decorators/auth.decorator'
import { Authorized } from '@/src/shared/decorators/authorized.decorator'
import { GqlAuthGuard } from '@/src/shared/guards/gql-auth.guard'

import { EventsService } from './events.service'
import { CreateEventInput } from './inputs/create-event.input'
// import { UpdateEventInput } from './inputs/update-event.input';
import { EventModel } from './models/event.model'

@Resolver(() => EventModel)
export class EventsResolver {
	constructor(private readonly eventsService: EventsService) {}

	@Query(() => [EventModel])
	async events() {
		return this.eventsService.getAllEvents()
	}

	@Authorization()
	@Mutation(() => EventModel)
	// @UseGuards(GqlAuthGuard)
	async createEvent(
		@Args('input') input: CreateEventInput,
		@Authorized() user: User
	) {
		return this.eventsService.createEvent(input, user.id)
	}
}

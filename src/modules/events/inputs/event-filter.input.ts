import { Field, Float, InputType } from '@nestjs/graphql'
import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType
} from 'prisma/generated'

@InputType()
export class EventFilterInput {
	@Field({ nullable: true })
	location?: string

	@Field(() => EventType, { nullable: true })
	eventType?: EventType

	@Field(() => [Float], { nullable: true })
	priceRange?: [number, number]

	@Field(() => [EventProperty], { nullable: true })
	eventProperties?: EventProperty[]

	@Field(() => EventStatus, { nullable: true })
	status?: EventStatus

	@Field(() => PaymentType, { nullable: true })
	paymentType?: PaymentType

	@Field(() => [String], { nullable: true })
	dateRange?: [string, string]

	@Field({ nullable: true })
	searchQuery?: string

	@Field({ nullable: true })
	organizerId?: string

	@Field({ nullable: true })
	isVerified?: boolean

	@Field({ nullable: true })
	ageRestriction?: number
}

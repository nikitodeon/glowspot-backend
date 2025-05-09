import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'

import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType
} from '@/prisma/generated'
import { PrismaService } from '@/src/core/prisma/prisma.service'

import { StorageService } from '../../notification/libs/storage/storage.service'

@Injectable()
export class EventParticipationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storageService: StorageService
	) {}

	async participateInEvent(eventId: string, userId: string) {
		try {
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			const existingParticipation = await this.prisma.event.findFirst({
				where: {
					id: eventId,
					participants: { some: { id: userId } }
				}
			})

			if (existingParticipation) {
				throw new ConflictException(
					'User already participates in this event'
				)
			}

			await this.prisma.event.update({
				where: { id: eventId },
				data: {
					participants: {
						connect: { id: userId }
					}
				}
			})

			return true
		} catch (error) {
			console.error('Error participating in event:', error)
			throw error
		}
	}
	async leaveEvent(eventId: string, userId: string) {
		try {
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			const existingParticipation = await this.prisma.event.findFirst({
				where: {
					id: eventId,
					participants: { some: { id: userId } }
				}
			})

			if (!existingParticipation) {
				throw new ConflictException(
					'User is not a participant of this event'
				)
			}

			await this.prisma.event.update({
				where: { id: eventId },
				data: {
					participants: {
						disconnect: { id: userId }
					}
				}
			})

			return true
		} catch (error) {
			console.error('Error leaving event:', error)
			throw error
		}
	}
	async getEventsWhereIParticipate(userId: string) {
		try {
			type EventWithDetails = {
				id: string
				title: string
				description: string
				start_time: Date
				end_time: Date | null
				photo_urls: string[]
				eventType: EventType
				eventProperties: EventProperty[]
				paymentType: PaymentType
				price: number | null
				currency: string | null
				posted_date: Date
				is_verified: boolean
				is_private: boolean
				max_participants: number | null
				tags: string[]
				status: EventStatus
				age_restriction: number | null
				created_at: Date
				updated_at: Date
				location_id: string
				address: string | null
				city: string
				place_name: string | null
				longitude: number
				latitude: number
				organizer_id: string
				username: string
				display_name: string
				avatar: string | null
				participants: Array<{
					id: string
					username: string
					display_name: string
					avatar: string | null
				}>
				favorited_by: Array<{ id: string }> | null
			}

			const events = await this.prisma.$queryRaw<EventWithDetails[]>`
			SELECT 
				e.*,
				l.id AS location_id,
				l.address,
				l.city,
				l.place_name,
				ST_X(l.coordinates::geometry) AS longitude,
				ST_Y(l.coordinates::geometry) AS latitude,
				u.id AS organizer_id,
				u.username,
				u.display_name,
				u.avatar,
				(
					SELECT json_agg(json_build_object(
						'id', p.id,
						'username', p.username,
						'display_name', p.display_name,
						'avatar', p.avatar
					))
					FROM "_EventParticipants" ep
					JOIN "users" p ON ep."B" = p.id
					WHERE ep."A" = e.id
				) AS participants,
				(
	SELECT json_agg(json_build_object(
		'id', f."B"
	))
	FROM "_FavoriteProperties" f
	WHERE f."A" = e.id
) AS favorited_by
			FROM "events" e
			JOIN "locations" l ON e."locationId" = l.id
			JOIN "users" u ON e."organizerId" = u.id
			JOIN "_EventParticipants" ep ON e.id = ep."A"
			WHERE ep."B" = ${userId}
			ORDER BY e.start_time ASC
			`

			return events.map(event => ({
				id: event.id,
				title: event.title,
				description: event.description,
				startTime: event.start_time,
				endTime: event.end_time,
				photoUrls: event.photo_urls,
				eventType: event.eventType,
				eventProperties: event.eventProperties,
				paymentType: event.paymentType,
				price: event.price,
				currency: event.currency,
				postedDate: event.posted_date,
				isVerified: event.is_verified,
				isPrivate: event.is_private,
				maxParticipants: event.max_participants,
				tags: event.tags,
				status: event.status,
				ageRestriction: event.age_restriction,
				createdAt: event.created_at,
				updatedAt: event.updated_at,
				location: {
					id: event.location_id,
					address: event.address,
					city: event.city,
					placeName: event.place_name,
					coordinates: {
						longitude: event.longitude,
						latitude: event.latitude
					}
				},
				organizer: {
					id: event.organizer_id,
					username: event.username,
					displayName: event.display_name,
					avatar: event.avatar
				},
				participants: event.participants
					? event.participants.map(p => ({
							id: p.id,
							username: p.username,
							displayName: p.display_name,
							avatar: p.avatar
						}))
					: [],
				favoritedBy: event.favorited_by
					? event.favorited_by.map(f => ({ id: f.id }))
					: []
			}))
		} catch (error) {
			console.error('Error fetching events where I participate:', error)
			throw new Error('Failed to fetch events where I participate')
		}
	}
}

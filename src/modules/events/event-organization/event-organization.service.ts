import { Injectable } from '@nestjs/common'
import axios from 'axios'
// import * as Upload from 'graphql-upload/Upload.js'
import * as sharp from 'sharp'

//   import { UpdateEventInput } from './inputs/update-event.input';

import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType
} from '@/prisma/generated'
import { PrismaService } from '@/src/core/prisma/prisma.service'

import { StorageService } from '../../notification/libs/storage/storage.service'

import { CreateEventInput } from './inputs/create-event.input'

type EventWithDetails = {
	id: string
	title: string
	description: string
	startTime: Date
	endTime: Date | null
	photoUrls: string[]
	eventType: EventType
	eventProperties: EventProperty[]
	paymentType: PaymentType
	price: number | null
	currency: string | null
	postedDate: Date
	isVerified: boolean
	isPrivate: boolean
	maxParticipants: number | null
	tags: string[]
	status: EventStatus
	ageRestriction: number | null
	createdAt: Date
	updatedAt: Date
	location: {
		id: string
		address: string | null
		city: string
		placeName: string | null
		coordinates: {
			longitude: number
			latitude: number
		}
	}
	organizer: {
		id: string
		username: string
		displayName: string
		avatar: string | null
		isVerified: boolean
	}
	participants: Array<{
		id: string
		username: string
		displayName: string
		avatar: string | null
	}>
}

@Injectable()
export class EventOrganizationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storageService: StorageService
	) {}

	private async geocodeAddress(
		address: string,
		city: string = 'Minsk'
	): Promise<{ longitude: number; latitude: number }> {
		try {
			const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
				{
					q: `${address}, ${city}`,
					format: 'json',
					limit: '1'
				}
			).toString()}`

			const response = await axios.get(geocodingUrl, {
				headers: {
					'User-Agent': 'EventApp (your@email.com)'
				}
			})

			if (response.data.length > 0) {
				return {
					longitude: parseFloat(response.data[0].lon),
					latitude: parseFloat(response.data[0].lat)
				}
			}
			return { longitude: 0, latitude: 0 }
		} catch (error) {
			console.error('Geocoding error:', error)
			return { longitude: 0, latitude: 0 }
		}
	}

	async createEvent(
		input: CreateEventInput,
		organizerId: string,
		photos?: any[]
	) {
		const { address, city, placeName, ...eventData } = input
		const { longitude, latitude } = await this.geocodeAddress(address, city)

		if (longitude === 0 || latitude === 0) {
			throw new Error('Geocoding failed')
		}

		try {
			// 1. Create location
			const locations = await this.prisma.$queryRaw<{ id: string }[]>`
		  INSERT INTO "locations" 
			(id, address, city, "place_name", coordinates, "created_at", "updated_at")
		  VALUES (
			gen_random_uuid(),
			${address || null}, 
			${city || 'Minsk'}, 
			${placeName || null}, 
			ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
			NOW(),
			NOW()
		  )
		  RETURNING id;
		  `

			if (!locations || locations.length === 0) {
				throw new Error('Failed to create location')
			}

			const locationId = locations[0].id

			// Process photos if provided
			const photoPaths: string[] = []
			if (photos && photos.length > 0) {
				for (const photo of photos) {
					const chunks: Buffer[] = []
					for await (const chunk of photo.createReadStream()) {
						chunks.push(chunk)
					}
					const buffer = Buffer.concat(chunks)

					const fileName = `/events/${organizerId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`

					const processedBuffer = await sharp(buffer)
						.resize(1280, 720)
						.webp()
						.toBuffer()

					await this.storageService.upload(
						processedBuffer,
						fileName,
						'image/webp'
					)

					photoPaths.push(fileName)
				}
			}

			// Фильтруем входные photoUrls, оставляя только те, что похожи на пути в хранилище
			const filteredInputPaths = (eventData.photoUrls || []).filter(
				path =>
					path.startsWith('/events/') || path.startsWith('/users/')
			)

			const allPhotoPaths = [...photoPaths, ...filteredInputPaths]

			const event = await this.prisma.event.create({
				data: {
					title: eventData.title,
					description: eventData.description,
					startTime: eventData.startTime,
					endTime: eventData.endTime || null,
					photoUrls: allPhotoPaths, // Сохраняем только пути
					eventType: eventData.eventType,
					eventProperties: eventData.eventProperties || [],
					paymentType: eventData.paymentType,
					price: eventData.price || null,
					currency: eventData.currency || 'BYN',
					isPrivate: eventData.isPrivate || false,
					maxParticipants: eventData.maxParticipants || null,
					tags: eventData.tags || [],
					ageRestriction: eventData.ageRestriction || null,
					status: 'UPCOMING',
					postedDate: new Date(),
					locationId,
					organizerId,
					participants: {
						connect: { id: organizerId }
					}
				},
				include: {
					location: true,
					organizer: true,
					participants: true
				}
			})

			return event
		} catch (err) {
			console.error('Error creating event:', err)
			throw new Error('Failed to create event')
		}
	}
	async updateEvent(
		id: string,
		input: CreateEventInput,
		organizerId: string,
		photos?: any[]
	) {
		const { address, city, placeName, ...eventData } = input
		const event = await this.prisma.event.findUnique({
			where: { id },
			include: { location: true }
		})

		if (!event) {
			throw new Error('Event not found')
		}
		if (event.organizerId !== organizerId) {
			throw new Error('Unauthorized to update this event')
		}

		let locationId = event.locationId
		// Обновляем или создаем новую локацию, если адрес изменился
		if (
			address !== event.location?.address ||
			city !== event.location?.city ||
			placeName !== event.location?.placeName
		) {
			const { longitude, latitude } = await this.geocodeAddress(
				address,
				city
			)

			if (longitude === 0 || latitude === 0) {
				throw new Error('Geocoding failed')
			}

			const locations = await this.prisma.$queryRaw<{ id: string }[]>`
			INSERT INTO "locations" 
			(id, address, city, "place_name", coordinates, "created_at", "updated_at")
			VALUES (
				gen_random_uuid(),
				${address || null}, 
				${city || 'Minsk'}, 
				${placeName || null}, 
				ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
				NOW(),
				NOW()
			)
			RETURNING id;
			`

			if (!locations || locations.length === 0) {
				throw new Error('Failed to create location')
			}
			locationId = locations[0].id
		}

		// Обработка новых фото
		const photoPaths: string[] = []
		if (photos && photos.length > 0) {
			for (const photo of photos) {
				const chunks: Buffer[] = []
				for await (const chunk of photo.createReadStream()) {
					chunks.push(chunk)
				}
				const buffer = Buffer.concat(chunks)

				const fileName = `/events/${organizerId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`

				const processedBuffer = await sharp(buffer)
					.resize(1280, 720)
					.webp()
					.toBuffer()

				await this.storageService.upload(
					processedBuffer,
					fileName,
					'image/webp'
				)

				photoPaths.push(fileName)
			}
		}

		const filteredInputPaths = (eventData.photoUrls || []).filter(
			path => path.startsWith('/events/') || path.startsWith('/users/')
		)
		const allPhotoPaths = [...photoPaths, ...filteredInputPaths]

		const updated = await this.prisma.event.update({
			where: { id },
			data: {
				title: eventData.title,
				description: eventData.description,
				startTime: eventData.startTime,
				endTime: eventData.endTime || null,
				photoUrls: allPhotoPaths,
				eventType: eventData.eventType,
				eventProperties: eventData.eventProperties || [],
				paymentType: eventData.paymentType,
				price: eventData.price || null,
				currency: eventData.currency || 'BYN',
				isPrivate: eventData.isPrivate || false,
				maxParticipants: eventData.maxParticipants || null,
				tags: eventData.tags || [],
				ageRestriction: eventData.ageRestriction || null,
				locationId
			},
			include: {
				location: true,
				organizer: true,
				participants: true
			}
		})

		return updated
	}
	async deleteEvent(eventId: string, userId: string) {
		try {
			// 1. Проверяем существует ли мероприятие и является ли пользователь организатором
			const event = await this.prisma.event.findUnique({
				where: { id: eventId },
				select: { organizerId: true, photoUrls: true }
			})

			if (!event) {
				throw new Error('Event not found')
			}

			if (event.organizerId !== userId) {
				throw new Error('You are not the organizer of this event')
			}

			// 2. Удаляем фотографии из хранилища
			if (event.photoUrls && event.photoUrls.length > 0) {
				await Promise.all(
					event.photoUrls.map(photoUrl =>
						this.storageService
							.remove(photoUrl)
							.catch(e =>
								console.error('Failed to delete photo:', e)
							)
					)
				)
			}

			// 3. Удаляем мероприятие из базы данных
			await this.prisma.event.delete({
				where: { id: eventId }
			})

			return true
		} catch (err) {
			console.error('Error deleting event:', err)
			throw new Error('Failed to delete event')
		}
	}
	private mapEventWithDetails(event: any) {
		console.log('[EventsService] Raw event data before mapping:', event)

		const mappedData = {
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
		}

		console.log('[EventsService] Mapped event data:', mappedData)
		return mappedData
	}
	async getEventsByOrganizer(organizerId: string) {
		console.log(
			'[EventsService] Starting getEventsByOrganizer for organizer ID:',
			organizerId
		)

		try {
			console.log('[EventsService] Executing SQL query...')
			const queryStartTime = Date.now()

			const events = await this.prisma.$queryRaw<EventWithDetails[]>`
			SELECT 
			  e.id,
			  e.title,
			  e.description,
			  e.start_time,
			  e.end_time,
			  e.photo_urls,
			  e."eventType",
			  e."eventProperties",
			  e."paymentType",
			  e.price,
			  e.currency,
			  e.posted_date,
			  e.is_verified,
			  e.is_private,
			  e.max_participants,
			  e.tags,
			  e.status,
			  e.age_restriction,
			  e.created_at,
			  e.updated_at,
			  l.id as location_id,
			  l.address,
			  l.city,
			  l.place_name,
			  ST_X(l.coordinates::geometry) as longitude,
			  ST_Y(l.coordinates::geometry) as latitude,
			  u.id as organizer_id,
			  u.username,
			  u.display_name as organizer_display_name,
			  u.avatar as organizer_avatar,
			  (
				SELECT json_agg(json_build_object(
				  'id', p.id,
				  'username', p.username,
				  'display_name', p.display_name,
				  'avatar', p.avatar
				))
				FROM users p
				JOIN "_EventParticipants" ep ON ep."B" = p.id
				WHERE ep."A" = e.id
			  ) as participants,
			  (
				SELECT json_agg(json_build_object(
				  'id', f."B"
				))
				FROM "_FavoriteProperties" f
				WHERE f."A" = e.id
			  ) AS favorited_by
			FROM events e
			JOIN locations l ON e."locationId" = l.id
			JOIN users u ON e."organizerId" = u.id
			WHERE e."organizerId" = ${organizerId}
			ORDER BY e.start_time ASC
		  `

			const queryDuration = Date.now() - queryStartTime
			console.log(
				`[EventsService] SQL query completed in ${queryDuration}ms`
			)

			console.log('[EventsService] Query result count:', events?.length)
			if (events?.length > 0) {
				console.log('[EventsService] First event sample:', {
					id: events[0].id,
					max_participants: events[0].maxParticipants?.toString()
				})
			}

			if (!events || events.length === 0) {
				console.warn(
					'[EventsService] No events found for organizer ID:',
					organizerId
				)
				return []
			}

			console.log('[EventsService] Mapping events data...')
			const mappedEvents = events
				.map(event => {
					try {
						// Преобразование BigInt в строку для безопасного логирования
						const eventForLog = {
							...event,
							max_participants: event.maxParticipants?.toString()
						}

						console.log(
							'[EventsService] Mapping event:',
							eventForLog
						)

						const mappedEvent = this.mapEventWithDetails(event)

						console.log('[EventsService] Mapped event:', {
							id: mappedEvent.id,
							maxParticipants:
								mappedEvent.maxParticipants?.toString(),
							participantsCount:
								mappedEvent.participants?.length || 0
						})

						return mappedEvent
					} catch (error) {
						console.error('[EventsService] Error mapping event:', {
							eventId: event?.id,
							error:
								error instanceof Error ? error.message : error
						})
						return null
					}
				})
				.filter(event => event !== null)

			console.log(
				'[EventsService] Successfully mapped',
				mappedEvents.length,
				'events'
			)
			return mappedEvents
		} catch (error) {
			console.error('[EventsService] Error in getEventsByOrganizer:', {
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString()
			})
			throw new Error(
				'Failed to fetch organizer events. See server logs for details.'
			)
		}
	}
}

import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import axios from 'axios'
import * as Upload from 'graphql-upload/Upload.js'
import * as sharp from 'sharp'
//   import { UpdateEventInput } from './inputs/update-event.input';
//   import { EventStatus, EventType, PaymentType, User } from '@prisma/client';
import * as wkt from 'wkt'

import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType,
	Prisma
} from '@/prisma/generated'
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import { PrismaService } from '@/src/core/prisma/prisma.service'

import { StorageService } from '../libs/storage/storage.service'

import { CreateEventInput } from './inputs/create-event.input'
import { EventModel } from './models/event.model'

// import { Prisma } from '@prisma/client'

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
	}
	participants: Array<{
		id: string
		username: string
		displayName: string
		avatar: string | null
	}>
}

@Injectable()
export class EventsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly storageService: StorageService
	) {}

	async getAllEvents(filter?: {
		location?: string
		eventType?: string
		priceRange?: [number, number]
		eventProperties?: string[]
		status?: string
		paymentType?: string
		dateRange?: [string | null, string | null]
		searchQuery?: string
		currency?: string
	}) {
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

			const whereConditions: string[] = []
			const queryParams: any[] = []

			const addCondition = (condition: string, ...params: any[]) => {
				whereConditions.push(condition)
				queryParams.push(...params)
			}

			// Счетчик параметров для правильной нумерации
			let paramCounter = 1

			// Фильтр по местоположению
			if (filter?.location) {
				addCondition(
					`(l.city ILIKE $${paramCounter} OR l.address ILIKE $${paramCounter})`,
					`%${filter.location}%`
				)
				paramCounter++
			}

			// Фильтр по типу события
			if (filter?.eventType) {
				addCondition(
					`e."eventType"::text = $${paramCounter}`,
					filter.eventType
				)
				paramCounter++
			}

			// Фильтр по цене и валюте
			if (filter?.priceRange?.length === 2) {
				const [min, max] = filter.priceRange.map(val =>
					val === null ? undefined : val
				)

				if (filter.currency && filter.currency !== 'any') {
					// Сценарий с валютой
					if (min === 0) {
						if (max !== undefined) {
							addCondition(
								`((e.price BETWEEN $${paramCounter} AND $${paramCounter + 1} AND e.currency = $${paramCounter + 2}::text) OR e."paymentType" = 'FREE')`,
								min,
								max,
								filter.currency
							)
							paramCounter += 3
						} else {
							addCondition(
								`((e.price >= $${paramCounter} AND e.currency = $${paramCounter + 1}::text) OR e."paymentType" = 'FREE')`,
								min,
								filter.currency
							)
							paramCounter += 2
						}
					} else {
						if (min !== undefined && max !== undefined) {
							addCondition(
								`e.price BETWEEN $${paramCounter} AND $${paramCounter + 1} AND e.currency = $${paramCounter + 2}::text`,
								min,
								max,
								filter.currency
							)
							paramCounter += 3
						} else if (min !== undefined) {
							addCondition(
								`e.price >= $${paramCounter} AND e.currency = $${paramCounter + 1}::text`,
								min,
								filter.currency
							)
							paramCounter += 2
						} else if (max !== undefined) {
							addCondition(
								`e.price <= $${paramCounter} AND e.currency = $${paramCounter + 1}::text`,
								max,
								filter.currency
							)
							paramCounter += 2
						}
					}
				} else {
					// Сценарий без валюты
					if (min === 0) {
						if (max !== undefined) {
							addCondition(
								`(e.price BETWEEN $${paramCounter} AND $${paramCounter + 1} OR e."paymentType" = 'FREE')`,
								min,
								max
							)
							paramCounter += 2
						} else {
							addCondition(
								`(e.price >= $${paramCounter} OR e."paymentType" = 'FREE')`,
								min
							)
							paramCounter++
						}
					} else {
						if (min !== undefined && max !== undefined) {
							addCondition(
								`e.price BETWEEN $${paramCounter} AND $${paramCounter + 1}`,
								min,
								max
							)
							paramCounter += 2
						} else if (min !== undefined) {
							addCondition(`e.price >= $${paramCounter}`, min)
							paramCounter++
						} else if (max !== undefined) {
							addCondition(`e.price <= $${paramCounter}`, max)
							paramCounter++
						}
					}
				}
			}

			// Отдельный фильтр по валюте (если не указан priceRange)
			if (
				filter?.currency &&
				filter.currency !== 'any' &&
				(!filter.priceRange || filter.priceRange.every(v => v === null))
			) {
				addCondition(
					`(e.currency = $${paramCounter}::text OR e."paymentType" = 'FREE')`,
					filter.currency
				)
				paramCounter++
			}

			// Фильтр по свойствам события
			if (filter?.eventProperties?.length) {
				const pgArray = `{${filter.eventProperties.map(p => `"${p}"`).join(',')}}`
				addCondition(
					`e."eventProperties" @> $${paramCounter}::text[]`,
					pgArray
				)
				paramCounter++
			}

			// Фильтр по статусу
			if (filter?.status && filter.status !== 'any') {
				addCondition(
					`e."status"::text = $${paramCounter}`,
					filter.status
				)
				paramCounter++
			}

			// Фильтр по типу оплаты
			if (filter?.paymentType) {
				addCondition(
					`e."paymentType"::text = $${paramCounter}`,
					filter.paymentType
				)
				paramCounter++
			}

			// Поиск по тексту
			if (filter?.searchQuery) {
				addCondition(
					`(e.title ILIKE $${paramCounter} OR e.description ILIKE $${paramCounter})`,
					`%${filter.searchQuery}%`
				)
				paramCounter++
			}

			// Фильтр по дате
			if (filter?.dateRange) {
				const [startDate, endDate] = filter.dateRange

				if (startDate && !endDate) {
					const startDateObj = new Date(startDate)
					addCondition(
						`(
					  (e.start_time >= $${paramCounter}) OR
					  (e.start_time <= $${paramCounter} AND 
					   (e.end_time IS NULL OR e.end_time >= $${paramCounter}))
					)`,
						startDateObj
					)
					paramCounter++
				} else if (!startDate && endDate) {
					const endDateObj = new Date(endDate)
					addCondition(
						`(
					  (e.start_time <= $${paramCounter} AND e.end_time IS NULL) OR
					  (e.start_time <= $${paramCounter} AND e.end_time IS NOT NULL AND 
					   (e.end_time <= $${paramCounter} OR e.end_time >= $${paramCounter}))
					)`,
						endDateObj
					)
					paramCounter++
				} else if (startDate && endDate) {
					const startDateObj = new Date(startDate)
					const endDateObj = new Date(endDate)
					addCondition(
						`(
					  (e.start_time >= $${paramCounter} AND e.end_time <= $${paramCounter + 1}) OR
					  (e.start_time <= $${paramCounter} AND 
					   (e.end_time IS NULL OR e.end_time >= $${paramCounter + 1})) OR
					  (e.start_time <= $${paramCounter} AND e.end_time >= $${paramCounter}) OR
					  (e.start_time >= $${paramCounter} AND e.start_time <= $${paramCounter + 1} AND 
					   (e.end_time IS NULL OR e.end_time >= $${paramCounter}))
					)`,
						startDateObj,
						endDateObj
					)
					paramCounter += 2
				}
			}
			// Собираем полный запрос
			const whereClause =
				whereConditions.length > 0
					? `WHERE ${whereConditions.join(' AND ')}`
					: ''

			const query = `
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
			  ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
			  ORDER BY e.start_time ASC
			`

			const events = await this.prisma.$queryRawUnsafe<
				EventWithDetails[]
			>(query, ...queryParams)

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
			console.error('Error fetching all events:', error)
			throw new Error('Failed to fetch all events')
		}
	}
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
	async getEventById(id: string): Promise<EventWithDetails> {
		console.log('[EventsService] Starting getEventById for ID:', id)

		try {
			console.log('[EventsService] Executing SQL query...')
			const queryStartTime = Date.now()

			// Полный SQL запрос с явными проверками
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
					u.username as username,
					u.display_name as display_name,
					u.avatar as organizer_avatar,
					(
						SELECT json_agg(json_build_object(
							'id', p.id,
							'username', p.username,
							'displayName', COALESCE(p.display_name, p.username),
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
				WHERE e.id = ${id}
			`

			const queryDuration = Date.now() - queryStartTime
			console.log(
				`[EventsService] SQL query completed in ${queryDuration}ms`
			)

			if (!events || events.length === 0) {
				console.warn('[EventsService] Event not found for ID:', id)
				throw new NotFoundException('Event not found')
			}

			// Детальное логирование перед маппингом
			console.log(
				'[EventsService] Raw SQL result:',
				JSON.stringify(
					events[0],
					(key, value) => {
						if (value === null) return 'NULL_VALUE'
						return value
					},
					2
				)
			)

			console.log('[EventsService] Mapping event data...')
			const mappedEvent = this.mapEventWithDetailsForEventById(events[0])

			// Валидация результата
			this.validateEventWithDetails(mappedEvent)

			console.log('[EventsService] Mapped event data:', {
				id: mappedEvent.id,
				title: mappedEvent.title,
				organizer: mappedEvent.organizer.username,
				participantsCount: mappedEvent.participants?.length || 0
			})

			return mappedEvent
		} catch (error) {
			console.error('[EventsService] Error in getEventById:', {
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString()
			})

			throw new Error(
				'Failed to fetch event. See server logs for details.'
			)
		}
	}

	private validateEventWithDetails(event: EventWithDetails): void {
		if (!event.organizer.username) {
			throw new Error(
				`Organizer username is missing for event ${event.id}`
			)
		}

		if (!event.organizer.displayName) {
			throw new Error(
				`Organizer displayName is missing for event ${event.id}`
			)
		}

		event.participants?.forEach(participant => {
			if (!participant.username) {
				throw new Error(
					`Participant username is missing in event ${event.id}`
				)
			}
			if (!participant.displayName) {
				throw new Error(
					`Participant displayName is missing in event ${event.id}`
				)
			}
		})
	}

	private mapEventWithDetailsForEventById(event: any): EventWithDetails {
		console.log('[EventsService] Raw event data before mapping:', event)

		// Проверка организатора
		if (!event.username) {
			console.error('Organizer username is missing:', {
				organizerId: event.organizer_id,
				rawUsername: event.username
			})
			throw new Error('Organizer username is required')
		}

		// Проверка участников
		if (event.participants) {
			event.participants.forEach((p: any) => {
				if (!p.username) {
					console.error('Participant username is missing:', {
						participantId: p.id,
						rawUsername: p.username
					})
					throw new Error('Participant username is required')
				}
			})
		}

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
				displayName: event.display_name || event.username,
				avatar: event.organizer_avatar
			},
			participants: event.participants
				? event.participants.map((p: any) => ({
						id: p.id,
						username: p.username,
						displayName: p.displayName || p.username,
						avatar: p.avatar
					}))
				: [],
			favoritedBy: event.favorited_by
				? event.favorited_by.map((f: any) => ({ id: f.id }))
				: []
		}

		console.log('[EventsService] Mapped event data:', mappedData)
		return mappedData
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

	async participateInEvent(eventId: string, userId: string) {
		try {
			// Проверяем, что событие существует
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})

			if (!event) {
				throw new NotFoundException('Event not found')
			}

			// Проверяем, что пользователь еще не участник
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

			// Добавляем участника
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

	async addToFavorites(eventId: string, userId: string): Promise<boolean> {
		try {
			// Проверяем существование события
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})
			if (!event) throw new NotFoundException('Event not found')

			// Проверяем, не добавлено ли уже в избранное
			const existingFavorite = await this.prisma.user.findFirst({
				where: {
					id: userId,
					favorites: { some: { id: eventId } }
				}
			})

			if (existingFavorite) {
				throw new ConflictException('Event already in favorites')
			}

			// Добавляем в избранное
			await this.prisma.user.update({
				where: { id: userId },
				data: { favorites: { connect: { id: eventId } } }
			})

			return true
		} catch (error) {
			console.error('Error adding to favorites:', error)
			throw error
		}
	}

	async removeFromFavorites(
		eventId: string,
		userId: string
	): Promise<boolean> {
		try {
			// Проверяем существование события
			const event = await this.prisma.event.findUnique({
				where: { id: eventId }
			})
			if (!event) throw new NotFoundException('Event not found')

			// Проверяем, есть ли в избранном
			const existingFavorite = await this.prisma.user.findFirst({
				where: {
					id: userId,
					favorites: { some: { id: eventId } }
				}
			})

			if (!existingFavorite) {
				throw new NotFoundException('Event not found in favorites')
			}

			// Удаляем из избранного
			await this.prisma.user.update({
				where: { id: userId },
				data: { favorites: { disconnect: { id: eventId } } }
			})

			return true
		} catch (error) {
			console.error('Error removing from favorites:', error)
			throw error
		}
	}

	async getFavoriteEvents(userId: string) {
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
			JOIN "_FavoriteProperties" fp ON e.id = fp."A"
			WHERE fp."B" = ${userId}
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
			console.error('Error fetching events user favorited:', error)
			throw new Error('Failed to fetch events user favorited')
		}
	}
}

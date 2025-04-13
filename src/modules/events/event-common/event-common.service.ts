import { Injectable, NotFoundException } from '@nestjs/common'

import {
	EventProperty,
	EventStatus,
	EventType,
	PaymentType
} from '@/prisma/generated'
import { PrismaService } from '@/src/core/prisma/prisma.service'

import { StorageService } from '../../notification/libs/storage/storage.service'

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
export class EventCommonService {
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
		verifiedOnly?: boolean
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
				organizer_verified: boolean
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
			if (filter?.verifiedOnly) {
				addCondition(`u.is_verified = $${paramCounter}`, true)
				paramCounter++
				console.log('Applying verifiedOnly filter')
			}

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
			// const whereClause =
			// 	whereConditions.length > 0
			// 		? `WHERE ${whereConditions.join(' AND ')}`
			// 		: ''

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
				u.is_verified as organizer_verified,
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
			console.log('Final SQL query:', query) // Логируем запрос
			console.log('Query params:', queryParams) // Логируем параметры
			const events = await this.prisma.$queryRawUnsafe<
				EventWithDetails[]
			>(query, ...queryParams)
			console.log('Found events:', events.length)
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
					avatar: event.avatar,
					isVerified: event.organizer_verified
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
					u.is_verified as organizer_is_verified,
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
				avatar: event.organizer_avatar,
				isVerified: event.organizer_is_verified
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
}

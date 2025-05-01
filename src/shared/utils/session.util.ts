import { InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

import type { User } from '@/prisma/generated'

import type { SessionMetadata } from '../types/session-metadata.types'

const logger = new Logger('SessionUtils')

export function saveSession(
	req: Request,
	user: User,
	metadata: SessionMetadata
) {
	return new Promise((resolve, reject) => {
		logger.log('Попытка сохранить сессию...')

		req.session.createdAt = new Date()
		req.session.userId = user.id
		req.session.metadata = metadata

		logger.debug(
			'Содержимое сессии перед сохранением:',
			JSON.stringify(req.session)
		)

		req.session.save(err => {
			if (err) {
				logger.error('Ошибка при сохранении сессии:', err)
				return reject(
					new InternalServerErrorException(
						'Не удалось сохранить сессию'
					)
				)
			}

			logger.log('Сессия успешно сохранена')

			resolve(user)
			resolve(user)
		})
	})
}

export function destroySession(req: Request, configService: ConfigService) {
	return new Promise((resolve, reject) => {
		// console.log('Destroying session cookies...', new Error().stack)
		req.session.destroy(err => {
			if (err) {
				return reject(
					new InternalServerErrorException(
						'Не удалось завершить сессию'
					)
				)
			}

			req.res?.clearCookie(
				configService.getOrThrow<string>('SESSION_NAME')
			)

			resolve(true)
		})
	})
}

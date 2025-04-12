import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException
} from '@nestjs/common'

import { PrismaService } from '@/src/core/prisma/prisma.service'

@Injectable()
export class HttpSessionGuard implements CanActivate {
	constructor(private readonly prismaService: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest()

		if (!request.session?.userId) {
			throw new UnauthorizedException('Пользователь не авторизован')
		}

		const user = await this.prismaService.user.findUnique({
			where: { id: request.session.userId }
		})

		request.user = user
		return true
	}
}

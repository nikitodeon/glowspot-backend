import { Field, InputType } from '@nestjs/graphql'
import {
	IsEmail,
	IsNotEmpty,
	IsString,
	Matches,
	MinLength
} from 'class-validator'

@InputType()
export class CreateUserInput {
	@Field(() => String)
	@IsString()
	@IsNotEmpty()
	@Matches(/^[a-zA-Zа-яА-ЯёЁ0-9]+(?:-[a-zA-Zа-яА-ЯёЁ0-9]+)*$/, {
		message:
			'Имя пользователя может содержать буквы (в т.ч. русские), цифры и дефисы'
	})
	public username: string

	@Field(() => String)
	@IsString()
	@IsNotEmpty()
	@IsEmail()
	public email: string

	@Field(() => String)
	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	public password: string
}

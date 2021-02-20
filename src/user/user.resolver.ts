import { Logger } from "@nestjs/common"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { hash, verify } from "argon2"
import { JwtService } from "src/jwt/jwt.service"
import { RegexpProvider } from "src/regexp/regexp.provider"
import { UserDto } from "./dto/user.dto"
import { User } from "./entities/user.entity"
import { UserInput } from "./inputs/user.input"
import { UserResponse } from "./responses/user.response"
import { UserService } from "./user.service"
import { UserInputValidator } from "./validators/userInput.validator"

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly regexpProvider: RegexpProvider,
  ) {}
  private readonly logger = new Logger(UserResolver.name)

  @Mutation(() => UserResponse, { nullable: true })
  async register(@Args("input") input: UserInput): Promise<UserResponse> {
    this.logger.log(this.register.name, `${UserResolver.name} - Mutation`)

    const { name, username, email, password, publicKey } = input

    this.logger.log(`Validating inputs for user ${name}`)

    const validator = new UserInputValidator(input)

    const errors = validator.validate()

    if (errors) {
      this.logger.error(`Found errors in inputs for user ${name}`)
      return { errors }
    }

    const hashedPassword = await hash(password)

    const userDto = new UserDto({
      name,
      username,
      email,
      password: hashedPassword,
      publicKey,
    })

    try {
      this.logger.log(`Saving user ${name}`)
      const user = await this.userService.save(userDto)

      this.jwtService.setUser(user)

      this.logger.log(`Generating access tokens for user ${name}`)

      const accessToken = this.jwtService.createAccessToken()
      const refreshToken = this.jwtService.createRefreshToken()

      return {
        user,
        accessToken,
        refreshToken,
      }
    } catch (error) {
      this.logger.error(`Couldn't save user ${name} because ${error.message}`)

      if (error.message.includes("email")) {
        return {
          errors: [
            {
              field: "email",
              message: "Email already in use",
            },
          ],
        }
      } else if (error.message.includes("usernameLowerCase")) {
        return {
          errors: [
            {
              field: "username",
              message: "Username already taken",
            },
          ],
        }
      }
    }
  }

  @Mutation(() => UserResponse, { nullable: true })
  async login(
    @Args("usernameOrEmail") usernameOrEmail: string,
    @Args("password") password: string,
  ): Promise<UserResponse> {
    this.logger.log(this.login.name, `${UserResolver.name} - Mutation`)

    const isEmail = this.regexpProvider.validEmail.test(usernameOrEmail)

    let validator: UserInputValidator

    if (isEmail) {
      validator = new UserInputValidator({
        email: usernameOrEmail,
        password,
      })
    } else {
      validator = new UserInputValidator({
        username: usernameOrEmail,
        password,
      })
    }

    this.logger.log(`Validating inputs for user ${usernameOrEmail}`)

    const errors = validator.validate()

    if (errors) {
      this.logger.error(`Found errors in inputs for user ${usernameOrEmail}`)
      return { errors }
    }

    this.logger.log(`Looking for user ${usernameOrEmail} in database`)

    const user = await this.userService.findByUsernameOrEmail(
      usernameOrEmail,
      isEmail,
    )

    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "The user does not exist.",
          },
        ],
      }
    }

    this.logger.log(`Verifying password for user ${usernameOrEmail}`)

    if (await verify(user.password, password)) {
      this.logger.log(`Password verified for user ${usernameOrEmail}`)

      this.jwtService.setUser(user)

      this.logger.log(`Generating access tokens for user ${usernameOrEmail}`)

      const accessToken = this.jwtService.createAccessToken()
      const refreshToken = this.jwtService.createRefreshToken()
      return { user, accessToken, refreshToken }
    } else {
      this.logger.log(
        `Password couldn't be verified for user ${usernameOrEmail}`,
      )

      return {
        errors: [
          {
            field: "password",
            message: "The password is incorrect.",
          },
        ],
      }
    }
  }

  @Query(() => User, { nullable: true })
  async userByUsername(@Args("username") username: string) {
    return this.userService.findByUsername(username)
  }
}
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { RegexpProvider } from "src/regexp/regexp.provider"
import { UserDto } from "./dto/user.dto"
import { User, UserDocument } from "./entities/user.entity"

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly regexpProvider: RegexpProvider,
  ) {}

  async save(userDto: UserDto): Promise<User> {
    const newUser = await this.userModel.create(userDto)
    return await newUser.save()
  }

  findByUsername(username: string): Promise<User> {
    return this.userModel
      .findOne({ usernameLowerCase: username.toLowerCase() })
      .exec()
  }

  findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec()
  }

  findByUsernameOrEmail(
    usernameOrEmail: string,
    isEmail: boolean,
  ): Promise<User> {
    if (isEmail) {
      return this.userModel
        .findOne({ email: usernameOrEmail.toLowerCase() })
        .exec()
    } else {
      return this.userModel
        .findOne({ usernameLowerCase: usernameOrEmail.toLowerCase() })
        .exec()
    }
  }
}

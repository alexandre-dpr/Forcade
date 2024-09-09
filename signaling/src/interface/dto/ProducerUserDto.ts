import {ProducerUser} from "../ProducerUser";

export class ProducerUserDto {
  id?: string
  username?: string

  static from(producerUser: ProducerUser): ProducerUserDto {
    return {
      id: producerUser.id,
      username: producerUser.username
    }
  }
}

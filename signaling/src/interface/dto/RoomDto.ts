import {Room} from "../Room";

export class RoomDto {
  id: string;
  name: string;
  password: string;

  constructor(id: string, name: string, password: string) {
    this.id = id;
    this.name = name;
    this.password = password;
  }

  static from(room: Room): RoomDto {
    return new RoomDto(room.id, room.name, room.password);
  }
}

import {ProducerUser} from "./ProducerUser";

export interface Room {
  id: string;
  name: string;
  password: string;
  users: Map<string, ProducerUser>;
}

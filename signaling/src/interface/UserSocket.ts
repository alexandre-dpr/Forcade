import { Socket, Namespace } from "socket.io";

export class UserSocket extends Socket {
  roomId?: string;

  constructor(nsp: Namespace, client: any, auth: Record<string, unknown>, previousSession?: any) {
    super(nsp, client, auth, previousSession);
  }
}

import * as fs from 'fs';
import * as https from 'https';
import {Server} from 'https';
import * as express from 'express';
import * as mediasoup from 'mediasoup';
import {Worker} from "mediasoup/node/lib/Worker";
import {Router} from "mediasoup/node/lib/Router";
import {Producer} from "mediasoup/node/lib/Producer";
import {Consumer} from "mediasoup/node/lib/Consumer";
import {MediaKind} from "mediasoup/node/lib/RtpParameters";
import {Server as SocketIoServer} from 'socket.io';
import * as cors from 'cors';
import {ProducerUser} from "./interface/ProducerUser";
import {ProducerUserDto} from "./interface/dto/ProducerUserDto";
import {Room} from "./interface/Room";
import {UserSocket} from "./interface/UserSocket";
import {RoomDto} from "./interface/dto/RoomDto";
import {ErrorMessages} from "./enum/ErrorMessages";

const app = express();
app.use(cors());
const IP: string = '0.0.0.0';
const INTERNET_IP: string = '192.168.1.25';
const PORT: number = 3000;


const server: Server = https.createServer({
  cert: fs.readFileSync('../localhost.crt'),
  key: fs.readFileSync('../localhost.key')
}, app);


const io: SocketIoServer = new SocketIoServer(server,
  {
    cors: {
      origin: 'https://localhost:4200'
    }
  });


const mediasoupOptions = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  },
};

const rooms: Map<String, Room> = new Map();

/**
 * Récupère le producer de la room, s'il n'existe pas, le crée.
 * @param joinedRoom Id de la room
 * @param socketId Id du socket
 */
function getProducer(joinedRoom: Room, socketId: string): ProducerUser {
  if (!rooms.has(joinedRoom.id)) {
    rooms.set(joinedRoom.id, {
      id: joinedRoom.id,
      name: joinedRoom.name ?? 'My room',
      password: joinedRoom.password ?? '',
      users: new Map<string, Producer>()
    });
  }
  const room = rooms.get(joinedRoom.id)!;
  if (room.users.has(socketId)) {
    return room.users.get(socketId)!;
  } else {
    const producerUser: ProducerUser = {};
    room.users.set(socketId, producerUser);
    return producerUser;
  }
}

function hasRoomPermission(room: Room): boolean {
  return !rooms.has(room.id) || rooms.get(room.id)!.password === room.password;
}

(async () => {
  const worker: Worker = await mediasoup.createWorker(mediasoupOptions.worker);
  const router: Router = await worker.createRouter({mediaCodecs: mediasoupOptions.router.mediaCodecs});

  io.on('connection', (socket: UserSocket) => {

    socket.on('createProducerTransport', async (joinedRoom: Room, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const producerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      getProducer(joinedRoom, socket.id).producerTransport = producerTransport;

      callback({
        id: producerTransport.id,
        iceParameters: producerTransport.iceParameters,
        iceCandidates: producerTransport.iceCandidates,
        dtlsParameters: producerTransport.dtlsParameters,
      });
    });

    socket.on('connectProducerTransport', async ({joinedRoom, dtlsParameters}, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const producerTransport = getProducer(joinedRoom, socket.id).producerTransport;
      if (!producerTransport) {
        callback({error: ErrorMessages.CONNEXION_ERROR});
        return;
      }

      await producerTransport.connect({dtlsParameters});
      callback({});
    });

    socket.on('createConsumerTransport', async (joinedRoom: Room, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const consumerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      getProducer(joinedRoom, socket.id).consumerTransport = consumerTransport;

      callback(callback({
        id: consumerTransport.id,
        iceParameters: consumerTransport.iceParameters,
        iceCandidates: consumerTransport.iceCandidates,
        dtlsParameters: consumerTransport.dtlsParameters,
      }));
    });

    socket.on('connectConsumerTransport', async ({joinedRoom, dtlsParameters}, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const consumerTransport = getProducer(joinedRoom, socket.id).consumerTransport;
      if (!consumerTransport) {
        callback({error: ErrorMessages.CONNEXION_ERROR});
        return;
      }

      await consumerTransport.connect({dtlsParameters});
      callback();
    });

    socket.on('produce', async ({joinedRoom, kind, rtpParameters, username}, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const producerTransport = getProducer(joinedRoom, socket.id).producerTransport;
      if (!producerTransport) {
        callback({error: ErrorMessages.CONNEXION_ERROR});
        return;
      }

      const producer: Producer = await producerTransport.produce({
        kind,
        rtpParameters
      });

      const producerUser = getProducer(joinedRoom, socket.id)
      producerUser.id = producer.id;
      producerUser.username = username;
      socket.roomId = joinedRoom.id;

      io.emit('newProducer', ProducerUserDto.from(producerUser));
      callback(ProducerUserDto.from(producerUser), RoomDto.from(rooms.get(joinedRoom.id)!));
    });

    socket.on('consume', async ({joinedRoom, producerId, rtpCapabilities}, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      if (!router.canConsume({producerId, rtpCapabilities})) {
        callback({error: 'Cannot consume'});
        return;
      }

      const consumerTransport = getProducer(joinedRoom, socket.id).consumerTransport;
      if (!consumerTransport) {
        callback({error: ErrorMessages.CONNEXION_ERROR});
        return;
      }

      const consumer: Consumer = await consumerTransport.consume({
        producerId,
        rtpCapabilities
      });
      callback({
        id: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    });

    socket.on('getProducers', async (joinedRoom: Room, callback) => {

      if (!hasRoomPermission(joinedRoom)) {
        callback({error: ErrorMessages.INVALID_ROOM_PASSWORD});
        return;
      }

      const producerArray: ProducerUserDto[] = [];
      const room = rooms.get(joinedRoom.id)!;

      if (room === undefined || room.users === undefined) {
        callback({error: ErrorMessages.ROOM_NOT_INITIALIZED});
        return;
      }

      room.users.forEach((producer, socketId) => {
        if (socket.id !== socketId) {
          producerArray.push(ProducerUserDto.from(producer));
        }
      });
      callback(producerArray);
    });

    socket.on('disconnect', () => {
      if (socket.roomId && rooms.has(socket.roomId)) {
        const room = rooms.get(socket.roomId)!;
        if (room.users.has(socket.id)) {
          let producer = getProducer(room, socket.id);
          io.emit('deletedProducer', ProducerUserDto.from(producer));
          room.users.delete(socket.id);
          if (room.users.size === 0) {
            rooms.delete(socket.roomId);
          }
        }
      }
    });

    socket.on('getRouterRtpCapabilities', (callback) => {
      const rtpCapabilities = router.rtpCapabilities;
      callback(rtpCapabilities);
    });

    /**
     * Retourne si la room a un mot de passe, ou qu'elle n'existe pas (pour le créer).
     */
    socket.on('getRoomInfo', (roomId: string, callback) => {
      callback(
        {
          hasName: rooms.has(roomId),
          hasPassword: !rooms.has(roomId) || rooms.get(roomId)!.password !== ''
        }
      );
    });
  });
})();


server.listen(PORT, IP, () => {
  console.log(`Mediasoup server is running on https://${IP}:${PORT}`);
});

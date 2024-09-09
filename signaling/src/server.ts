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
import {Server as SocketIoServer, Socket} from 'socket.io';
import * as cors from 'cors';
import {ProducerUser} from "./interface/ProducerUser";
import {ProducerUserDto} from "./interface/dto/ProducerUserDto";

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


let producers: Map<string, ProducerUser> = new Map();

function getProducer(socketId: string): ProducerUser {
  if (producers.has(socketId)) {
    return producers.get(socketId)!;
  } else {
    const producerUser: ProducerUser = {};
    producers.set(socketId, producerUser);
    return producerUser;
  }
}

(async () => {
  const worker: Worker = await mediasoup.createWorker(mediasoupOptions.worker);
  const router: Router = await worker.createRouter({mediaCodecs: mediasoupOptions.router.mediaCodecs});

  io.on('connection', (socket: Socket) => {

    socket.on('createProducerTransport', async (callback) => {
      const producerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      getProducer(socket.id).producerTransport = producerTransport;

      callback({
        id: producerTransport.id,
        iceParameters: producerTransport.iceParameters,
        iceCandidates: producerTransport.iceCandidates,
        dtlsParameters: producerTransport.dtlsParameters,
      });
    });

    socket.on('connectProducerTransport', async ({transportId, dtlsParameters}, callback) => {
      await getProducer(socket.id).producerTransport!.connect({dtlsParameters});
      callback();
    });

    socket.on('createConsumerTransport', async (callback) => {
      const consumerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      getProducer(socket.id).consumerTransport = consumerTransport;

      callback(callback({
        id: consumerTransport.id,
        iceParameters: consumerTransport.iceParameters,
        iceCandidates: consumerTransport.iceCandidates,
        dtlsParameters: consumerTransport.dtlsParameters,
      }));
    });

    socket.on('connectConsumerTransport', async ({transportId, dtlsParameters}, callback) => {
      await getProducer(socket.id).consumerTransport!.connect({dtlsParameters});
      callback();
    });

    socket.on('produce', async ({kind, rtpParameters, username}, callback) => {
      const producer: Producer = await getProducer(socket.id).producerTransport!.produce({kind, rtpParameters});

      const producerUser = getProducer(socket.id)
      producerUser.id = producer.id;
      producerUser.username = username;

      io.emit('newProducer', ProducerUserDto.from(producerUser));
      callback(ProducerUserDto.from(producerUser));
    });

    socket.on('consume', async ({producerId, rtpCapabilities}, callback) => {
      if (!router.canConsume({producerId, rtpCapabilities})) {
        callback({error: 'Cannot consume'});
        return;
      }
      const consumer: Consumer = await getProducer(socket.id).consumerTransport!.consume({producerId, rtpCapabilities});
      callback({
        id: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    });

    socket.on('getProducers', async (callback) => {
      const producerArray: ProducerUserDto[] = [];
      producers.forEach((producer, socketId) => {
        if (socket.id !== socketId) {
          producerArray.push(ProducerUserDto.from(producer));
        }
      });
      callback(producerArray);
    });

    socket.on('disconnect', () => {
      if (producers.has(socket.id)) {
        let producer = getProducer(socket.id);
        io.emit('deletedProducer', ProducerUserDto.from(producer));
        producers.delete(socket.id);
      }
    });

    socket.on('getRouterRtpCapabilities', (callback) => {
      const rtpCapabilities = router.rtpCapabilities;
      callback(rtpCapabilities);
    });
  });
})();


server.listen(PORT, IP, () => {
  console.log(`Mediasoup server is running on https://${IP}:${PORT}`);
});

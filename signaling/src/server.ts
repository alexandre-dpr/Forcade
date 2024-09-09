import * as fs from 'fs';
import * as https from 'https';
import {Server} from 'https';
import * as express from 'express';
import * as mediasoup from 'mediasoup';
import {Server as SocketIoServer, Socket} from 'socket.io';
import * as cors from 'cors';
import {WebRtcTransport} from "mediasoup/node/lib/WebRtcTransport";
import {Worker} from "mediasoup/node/lib/Worker";
import {Router} from "mediasoup/node/lib/Router";


const app = express();
const IP: string = '0.0.0.0';
const INTERNET_IP: string = '192.168.1.25';
const PORT: number = 3000;

app.use(cors());


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
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  },
};


let producerTransports: Map<string, WebRtcTransport> = new Map();
let consumerTransports: Map<string, WebRtcTransport> = new Map();
let producers: Map<string, string> = new Map();

function getProducerTransport(socketId: string): WebRtcTransport {
  const transport = producerTransports.get(socketId);
  if (transport) {
    return transport;
  }
  throw new Error(`Producer transport "${socketId}" not found`);
}

function getConsumerTransport(socketId: string): WebRtcTransport {
  const transport = consumerTransports.get(socketId);
  if (transport) {
    return transport;
  }
  throw new Error(`Consumer transport "${socketId}" not found`);
}

(async () => {
  const worker: Worker = await mediasoup.createWorker(mediasoupOptions.worker);
  // @ts-ignore
  const router: Router = await worker.createRouter({mediaCodecs: mediasoupOptions.router.mediaCodecs});

  io.on('connection', (socket: Socket) => {

    socket.on('createProducerTransport', async (callback) => {
      const producerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      producerTransports.set(socket.id, producerTransport);

      callback({
        id: producerTransport.id,
        iceParameters: producerTransport.iceParameters,
        iceCandidates: producerTransport.iceCandidates,
        dtlsParameters: producerTransport.dtlsParameters,
      });
    });

    socket.on('connectProducerTransport', async ({transportId, dtlsParameters}, callback) => {
      await getProducerTransport(socket.id).connect({dtlsParameters});
      callback();
    });

    socket.on('createConsumerTransport', async (callback) => {
      const consumerTransport = await router.createWebRtcTransport({
        listenIps: [{ip: IP, announcedIp: INTERNET_IP}],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      consumerTransports.set(socket.id, consumerTransport);

      callback(callback({
        id: consumerTransport.id,
        iceParameters: consumerTransport.iceParameters,
        iceCandidates: consumerTransport.iceCandidates,
        dtlsParameters: consumerTransport.dtlsParameters,
      }));
    });

    socket.on('connectConsumerTransport', async ({transportId, dtlsParameters}, callback) => {
      await getConsumerTransport(socket.id).connect({dtlsParameters});
      callback();
    });

    socket.on('produce', async ({kind, rtpParameters}, callback) => {
      const producer = await getProducerTransport(socket.id).produce({kind, rtpParameters});
      producers.set(socket.id, producer.id);
      const producerObject = {
        id: producer.id,
      }
      io.emit('newProducer', producerObject);
      callback(producerObject);
    });

    socket.on('consume', async ({producerId, rtpCapabilities}, callback) => {
      if (!router.canConsume({producerId, rtpCapabilities})) {
        callback({error: 'Cannot consume'});
        return;
      }
      const consumer = await getConsumerTransport(socket.id).consume({producerId, rtpCapabilities});
      callback({
        id: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    });

    socket.on('getProducers', async (callback) => {
      let producerArray: { id: string }[] = [];
      producers.forEach((value, key) => {
        if (socket.id !== key) {
          producerArray.push({id: value});
        }
      });
      callback(producerArray);
    });

    socket.on('disconnect', () => {
      if (producers.has(socket.id)) {
        let producerId = producers.get(socket.id);
        io.emit('deletedProducer', {id: producerId});
        producers.delete(socket.id);
      }
      producerTransports.delete(socket.id);
      consumerTransports.delete(socket.id);
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

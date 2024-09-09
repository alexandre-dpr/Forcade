const fs = require('fs');
const https = require('https');
const express = require('express');
const mediasoup = require('mediasoup');
const socketIo = require('socket.io');
const cors = require('cors');


const app = express();
const IP = '0.0.0.0';
const INTERNET_IP = '192.168.1.25';
const PORT = 3000;

app.use(cors());


const server = https.createServer({
    cert: fs.readFileSync('../localhost.crt'),
    key: fs.readFileSync('../localhost.key')
}, app);


const io = socketIo(server,
    {
        cors: {
            origin: 'https://localhost:4200'
        }
    });


const mediasoupOptions = {
    worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
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


let producerTransports = new Map();
let consumerTransports = new Map();
let producers = new Map();

(async () => {
    const worker = await mediasoup.createWorker(mediasoupOptions.worker);
    const router = await worker.createRouter({mediaCodecs: mediasoupOptions.router.mediaCodecs});

    io.on('connection', (socket) => {

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
            await producerTransports.get(socket.id).connect({dtlsParameters});
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
            await consumerTransports.get(socket.id).connect({dtlsParameters});
            callback();
        });

        socket.on('produce', async ({kind, rtpParameters}, callback) => {
            const producer = await producerTransports.get(socket.id).produce({kind, rtpParameters});
            producers.set(socket.id, producer.id);
            io.emit('newProducer', {id: producer.id});
            callback({
                id: producer.id,
            });
        });

        socket.on('consume', async ({producerId, rtpCapabilities}, callback) => {
            if (!router.canConsume({producerId, rtpCapabilities})) {
                callback({error: 'Cannot consume'});
                return;
            }
            const consumer = await consumerTransports.get(socket.id).consume({producerId, rtpCapabilities});
            callback({
                id: consumer.id,
                producerId: producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        });

        socket.on('getProducers', async (callback) => {
            let producerArray = [];
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

import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import {TransportParameters} from "../../interfaces/TransportParameters";
import {Producer} from "../../interfaces/Producer";
import {Data} from "@angular/router";
import {Transport} from "mediasoup-client/lib/types";
import {AudioService} from "../audioService/audio.service";

@Injectable({
  providedIn: 'root',
})
export class WebRTCService {
  private socket: Socket;
  private device: mediasoupClient.Device;
  private producerTransport: Transport<Data>;
  private consumerTransport: Transport<Data>;
  public producer: Producer;
  public producers: Producer[] = [];

  constructor(private audioService: AudioService) {
    this.socket = io(`https://${window.location.hostname}:3000`, {
      transports: ['websocket'],
      secure: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to the server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from the server');
      this.audioService.playDisconnectionSound();
    });

    this.socket.on('newProducer', (producer: Producer) => {
      if (this.producer) {
        console.log(`New producer available: ${producer.username} - ${producer.id}`);
        this.producers.push(producer);
        this.consumeMedia(producer);
        this.audioService.playJoinedSound();
      }
    });

    this.socket.on('deletedProducer', (producer: Producer) => {
      if (this.producer) {
        console.log(`Producer deleted: ${producer.username} - ${producer.id}`);
        this.producers = this.producers.filter(p => p.id !== producer.id);
      }
    });

    this.device = new mediasoupClient.Device();
    this.loadDevice();
  }

  async startCall() {
    await this.createProducerTransport();
    await this.createConsumerTransport();
    await this.produceMedia();
    this.getProducers();
  }

  private async requestMediaPermissions(): Promise<MediaStream> {
    return await navigator.mediaDevices.getUserMedia(
      {
        audio: {
          autoGainControl: false,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 512000,
          sampleSize: 512
        }
      });
  }

  private async createProducerTransport() {
    this.socket.emit('createProducerTransport', (transport: TransportParameters) => {
      this.producerTransport = this.device.createSendTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      this.producerTransport.on('connect', ({dtlsParameters}: any, callback: any) => {
        this.socket.emit('connectProducerTransport', {dtlsParameters}, () => {
          callback();
        });
      });

      this.producerTransport.on('produce', async ({kind, rtpParameters}: any, callback: any) => {
        const username = window.prompt('Enter your username');
        this.socket.emit('produce', {kind, rtpParameters, username}, (response: Producer) => {
          this.producer = response;
          callback(response);
        });
      });

    });
  }

  private async createConsumerTransport() {
    this.socket.emit('createConsumerTransport', (transport: TransportParameters) => {
      this.consumerTransport = this.device.createRecvTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      this.consumerTransport.on('connect', ({dtlsParameters}: any, callback: any) => {
        this.socket.emit('connectConsumerTransport', {dtlsParameters}, () => {
          callback();
        });
      });

    });
  }

  private async produceMedia() {
    try {
      const stream = await this.requestMediaPermissions();
      const audioTrack = stream.getAudioTracks()[0];

      if (audioTrack && this.producerTransport && !this.producerTransport.closed) {
        await this.producerTransport.produce({track: audioTrack});
        this.audioService.playConnectionSound();
      }

    } catch (error) {
      console.error('Error producing media:', error);
    }
  }

  private async consumeMedia(producer: Producer) {
    const rtpCapabilities = this.device.rtpCapabilities;

    if (this.producer.id !== producer.id) {
      this.socket.emit('consume', {producerId: producer.id, rtpCapabilities}, async (data: any) => {
        if (data.error) {
          console.error(data.error);
          return;
        }

        const consumer = await this.consumerTransport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        const stream = new MediaStream();
        stream.addTrack(consumer.track);
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(error => console.error('Error playing audio:', error));
      });
    } else {
      console.error('Cannot consume your own media');
    }
  }

  private loadDevice() {
    this.socket.emit('getRouterRtpCapabilities', async (data: any) => {
      if (!this.device.loaded) {
        await this.device.load({routerRtpCapabilities: data})
      }
    });
  }

  private getProducers() {
    this.socket.emit('getProducers', (producers: Producer[]) => {
      producers.forEach(async (producer: Producer) => {
        await this.consumeMedia(producer);
        this.producers.push(producer);
      });
    });
  }
}

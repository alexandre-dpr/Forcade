import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import {TransportParameters} from "../../interfaces/TransportParameters";
import {Producer} from "../../interfaces/Producer";
import {Data} from "@angular/router";
import {Transport} from "mediasoup-client/lib/types";
import {AudioService} from "../audioService/audio.service";
import {Room} from "../../interfaces/Room";
import {ErrorMessages} from "../../enum/ErrorMessages";
import {BehaviorSubject} from "rxjs";
import {RoomInfo} from "../../interfaces/RoomInfo";
import {GAIN} from "../../util/Constants";
import {NotificationService} from "../notificationService/notification.service";
import {TranslateService} from "@ngx-translate/core";

@Injectable({
  providedIn: 'root',
})
export class WebRTCService {
  private socket: Socket;
  private device: mediasoupClient.Device;
  private producerTransport: Transport<Data>;
  private consumerTransport: Transport<Data>;
  public producer: Producer;
  public producers: Map<string, Producer> = new Map();
  public room: Room;
  public username: string;
  public masterGain: number = GAIN.BASE;
  public soundMuted: boolean = false;

  public connected = new BehaviorSubject<boolean>(false);

  constructor(private audioService: AudioService, private notificationService: NotificationService, private translateService: TranslateService) {
    this.socket = io(`https://${window.location.hostname}:3000`, {
      transports: ['websocket'],
      secure: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to the server');
      this.connected.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from the server');
      this.audioService.playDisconnectionSound();
      this.connected.next(false);
    });

    this.socket.on('newProducer', (producer: Producer) => {
      if (this.producer) {
        console.log(`New producer available: ${producer.username} - ${producer.id}`);
        this.producers.set(producer.id, producer);
        this.consumeMedia(producer);
        this.audioService.playJoinedSound();
      }
    });

    this.socket.on('deletedProducer', (producer: Producer) => {
      if (this.producer) {
        console.log(`Producer deleted: ${producer.username} - ${producer.id}`);
        this.producers.delete(producer.id);
        this.audioService.playLeftSound();
      }
    });

    this.device = new mediasoupClient.Device();
    this.loadDevice();
    this.getMasterGain();
  }

  async startCall(room: Room, username: string) {
    this.room = room;
    this.username = username;
    await this.createProducerTransport();
    await this.createConsumerTransport();
    await this.produceMedia();
    this.getProducers();
  }

  public async getRoomInfo(roomId: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      this.socket.emit('getRoomInfo', roomId, (roomInfo: RoomInfo) => {
        if (roomInfo) {
          resolve(roomInfo);
        } else {
          reject(new Error('Failed to get room info'));
        }
      });
    });
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
    this.socket.emit('createProducerTransport', this.room, (transport: TransportParameters) => {
      this.checkIfError(transport);

      this.producerTransport = this.device.createSendTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      this.producerTransport.on('connect', ({dtlsParameters}: any, callback: any) => {
        this.socket.emit('connectProducerTransport', {joinedRoom: this.room, dtlsParameters}, (message: any) => {
          this.checkIfError(message);
          callback();
        });
      });

      this.producerTransport.on('produce', async ({kind, rtpParameters}: any, callback: any) => {
        this.socket.emit('produce', {
          joinedRoom: this.room,
          kind,
          rtpParameters,
          username: this.username
        }, (createdProducer: Producer, joinedRoom: Room) => {
          this.checkIfError(createdProducer);
          this.producer = createdProducer;
          this.room = joinedRoom;
          callback(createdProducer);
        });
      });

    });
  }

  private async createConsumerTransport() {
    this.socket.emit('createConsumerTransport', this.room, (transport: TransportParameters) => {
      this.checkIfError(transport);

      this.consumerTransport = this.device.createRecvTransport({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      this.consumerTransport.on('connect', ({dtlsParameters}: any, callback: any) => {
        this.socket.emit('connectConsumerTransport', {joinedRoom: this.room, dtlsParameters}, (message: any) => {
          this.checkIfError(message);
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
      this.socket.emit('consume', {
        joinedRoom: this.room,
        producerId: producer.id,
        rtpCapabilities
      }, async (data: any) => {
        this.checkIfError(data);

        const consumer = await this.consumerTransport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        const stream = new MediaStream();
        consumer.track.enabled = !this.soundMuted;
        stream.addTrack(consumer.track);
        producer.track = consumer.track;
        const audio = new Audio();
        audio.srcObject = stream;

        const audioContext = new AudioContext();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = this.masterGain;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (this.producers.has(producer.id)) {
          this.producers.get(producer.id)!.gainNode = gainNode;
        }
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
    this.socket.emit('getProducers', this.room, (producers: Producer[]) => {

      this.checkIfError(producers, ((error: string) => {
        console.log('Error getting producers:', error);
        if (error === ErrorMessages.ROOM_NOT_INITIALIZED) {
          window.location.reload();
        }
      }));

      producers.forEach(async (producer: Producer) => {
        console.log('calling consumeMedia from getProducers');
        console.log('producers', producers);
        console.log('producer', producer);
        await this.consumeMedia(producer);
        this.producers.set(producer.id, producer);
      });
    });
  }

  private checkIfError(data: any, callback?: any) {
    if (data && data.error) {
      if (callback) {
        callback(data.error);
      } else {
        this.notificationService.showNotification(this.translateService.instant(data.error), 'error');
        throw new Error(data.error);
      }
    }
  }

  updateGain(producerId: string, value: number) {
    if (this.producers.has(producerId)) {
      const producer = this.producers.get(producerId);
      if (producer && producer.gainNode) {
        producer.gainNode.gain.value = value;
      }
    }
  }

  getMasterGain() {
    const masterGain = localStorage.getItem('masterGain');
    if (masterGain) {
      this.masterGain = parseFloat(masterGain);
    }
  }

  updateMasterGain(value: number) {
    const volumeDifference = value - this.masterGain;
    this.masterGain = value;
    this.producers.forEach((producer) => {
      if (producer.gainNode) {
        if (producer.gainNode.gain.value + volumeDifference > GAIN.MAX_VALUE) {
          producer.gainNode.gain.value = GAIN.MAX_VALUE;
        } else if (producer.gainNode.gain.value + volumeDifference < GAIN.MIN_VALUE) {
          producer.gainNode.gain.value = GAIN.MIN_VALUE;
        } else {
          producer.gainNode.gain.value = producer.gainNode.gain.value + volumeDifference;
        }
      }
    });
    localStorage.setItem('masterGain', value.toString());
  }

  muteToggle() {
    this.producers.forEach((producer) => {
      if (producer.track) {
        producer.track.enabled = !producer.track.enabled;
      }
    });
    this.soundMuted = !this.soundMuted;
  }
}

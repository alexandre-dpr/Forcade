import {Injectable} from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {AudioService} from "../audioService/audio.service";
import {SignalingService} from "../signaling/signaling-service";

@Injectable({
  providedIn: 'root',
})
export class WebRTCService {
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private config = {
    iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
    sdpSemantics: 'unified-plan'
  };

  public isConnected = new BehaviorSubject(false);

  constructor(private signalingService: SignalingService, private audioService: AudioService) {
    this.signalingService.onMessage(this.handleSignalingMessage.bind(this));
  }

  async startCall() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
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
      console.log('Local stream obtained');
      this.peerConnection = new RTCPeerConnection(this.config);

      this.peerConnection.onicecandidate = ({candidate}) => {
        if (candidate) {
          console.log('New ICE candidate:', JSON.stringify(candidate));
          this.signalingService.sendMessage({type: 'candidate', candidate});
        }
      };

      this.peerConnection.ontrack = (event) => {
        console.log('Remote track received');
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play();
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State:', this.peerConnection?.iceConnectionState);
        if (this.peerConnection?.iceConnectionState === 'connected') {
          console.log('ICE Connection established');
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection State:', this.peerConnection?.connectionState);

        if (this.peerConnection?.connectionState === 'connected') {
          this.isConnected.next(true);
          this.audioService.playConnectionSound();

        } else if (this.peerConnection?.connectionState === 'disconnected') {
          this.isConnected.next(false);
          this.audioService.playDisconnectionSound();

        } else {
          this.isConnected.next(false);
        }
      };

      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
          console.log('Track added to peer connection');
        }
      });

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.peerConnection.setLocalDescription(offer);
      console.log('SDP Offer created and set as local description:', JSON.stringify(offer));
      this.signalingService.sendMessage({type: 'offer', offer});
    } catch (error) {
      console.log(navigator)
      console.log(error)
      console.error('Error during startCall:', error);
    }
  }

  async handleRemoteOffer(offer: RTCSessionDescriptionInit) {
    try {
      if (!this.peerConnection) {
        console.error('Peer connection is not initialized');
        return;
      }
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote offer set as remote description');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('SDP Answer created and set as local description:', JSON.stringify(answer));
      this.signalingService.sendMessage({type: 'answer', answer});
    } catch (error) {
      console.error('Error during handleRemoteOffer:', error);
    }
  }

  async handleRemoteAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (!this.peerConnection) {
        console.error('Peer connection is not initialized');
        return;
      }
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote answer set as remote description');
    } catch (error) {
      console.error('Error during handleRemoteAnswer:', error);
    }
  }

  async handleRemoteCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (!this.peerConnection) {
        console.error('Peer connection is not initialized');
        return;
      }
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Remote candidate added');
      if (this.peerConnection.getReceivers().length > 1) {
        this.audioService.playJoinedSound();
      }
    } catch (error) {
      console.error('Error during handleRemoteCandidate:', error);
    }
  }

  private handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'offer':
        this.handleRemoteOffer(message.offer);
        break;
      case 'answer':
        this.handleRemoteAnswer(message.answer);
        break;
      case 'candidate':
        this.handleRemoteCandidate(message.candidate);
        break;
    }
  }
}

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SignalingService {
  private socket: WebSocket;

  constructor() {
    this.socket = new WebSocket(`wss://${window.location.hostname}:3000`);
  }

  sendMessage(message: any) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open. Ready state: ' + this.socket.readyState);
    }
  }

  onMessage(callback: (message: any) => void) {
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };
  }
}

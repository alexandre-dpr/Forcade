import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  constructor() {
  }

  private masterVolume: number = 0.6;

  private readonly BASE_FOLDER = 'assets';

  public playConnectionSound() {
    this.playSound(this.BASE_FOLDER + '/connected.mp3')
  }

  public playDisconnectionSound() {
    this.playSound(this.BASE_FOLDER + '/disconnected.mp3')
  }

  public playJoinedSound() {
    this.playSound(this.BASE_FOLDER + '/joined.mp3')
  }

  private playSound(sound: string) {
    const audio = new Audio(sound);
    audio.volume = this.masterVolume;
    audio.play().catch((error) => {
      console.error('Error playing audio:', error);
    });
  }
}

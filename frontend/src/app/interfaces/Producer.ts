export interface Producer {
  id: string;
  username: string;
  gainNode?: GainNode;
  track?: MediaStreamTrack;
}

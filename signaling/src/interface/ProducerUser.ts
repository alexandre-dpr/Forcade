import {WebRtcTransport} from "mediasoup/node/lib/WebRtcTransport";

export interface ProducerUser {
  id?: string
  username?: string,
  producerTransport?: WebRtcTransport
  consumerTransport?: WebRtcTransport
}

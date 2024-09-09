import {DtlsParameters, IceCandidate, IceParameters} from "mediasoup-client/lib/Transport";

export interface TransportParameters {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

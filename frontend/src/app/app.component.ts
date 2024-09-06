import {ChangeDetectorRef, Component} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WebRTCService } from './services/webRTC/web-rtc.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(public webRTCService: WebRTCService, private cdr: ChangeDetectorRef) {}

  startCall() {
    this.webRTCService.startCall();
    this.webRTCService.isConnected.subscribe(() => {
      this.cdr.detectChanges();
    });
  }
}

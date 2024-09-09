import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {WebRTCService} from './services/webRTC/web-rtc.service';
import {NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgForOf, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(public webRTCService: WebRTCService) {
  }

  startCall() {
    this.webRTCService.startCall();
  }
}

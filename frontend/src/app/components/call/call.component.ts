import {Component} from '@angular/core';
import {WebRTCService} from "../../services/webRTC/web-rtc.service";
import {KeyValuePipe, NgForOf, NgIf} from "@angular/common";
import {MatSlider, MatSliderThumb} from "@angular/material/slider";
import {FormsModule} from "@angular/forms";
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [
    KeyValuePipe,
    NgForOf,
    NgIf,
    MatSlider,
    MatSliderThumb,
    FormsModule,
    MatIcon
  ],
  templateUrl: './call.component.html',
  styleUrl: './call.component.scss'
})
export class CallComponent {

  constructor(public webRTCService: WebRTCService) {
  }


}

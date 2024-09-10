import {Component} from '@angular/core';
import {NgForOf, NgIf} from "@angular/common";
import {WebRTCService} from "../../services/webRTC/web-rtc.service";
import {ActivatedRoute, Router} from "@angular/router";
import {RouteNames} from "../../enum/RouteNames";

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [
    NgForOf,
    NgIf
  ],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent {

  roomInfo: any;

  constructor(public webRTCService: WebRTCService, private route: ActivatedRoute, private router: Router) {
    webRTCService.connected.subscribe(connected => {

      if (connected) {
        this.route.paramMap.subscribe(params => {
          const roomId = params.get('roomId');

          if (roomId) {
            this.roomInfo = this.webRTCService.getRoomInfo(roomId)

          } else {
            this.router.navigate([RouteNames.HOME])
          }
        });
      }
    });
  }

  // TODO Ajouter un formulaire pour rejoindre une room
}

import {Component, signal} from '@angular/core';
import {KeyValuePipe, NgForOf, NgIf} from "@angular/common";
import {WebRTCService} from "../../services/webRTC/web-rtc.service";
import {ActivatedRoute, Router} from "@angular/router";
import {RouteNames} from "../../enum/RouteNames";
import {RoomInfo} from "../../interfaces/RoomInfo";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {MatFormField} from "@angular/material/form-field";
import {MatInput, MatInputModule} from "@angular/material/input";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {MatButton, MatIconButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";
import {CallComponent} from "../../components/call/call.component";
import {TranslateModule, TranslateService} from "@ngx-translate/core";


@Component({
  selector: 'app-room',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    MatFormField,
    ReactiveFormsModule,
    MatInput,
    MatInputModule,
    MatProgressSpinner,
    MatButton,
    MatIcon,
    MatIconButton,
    KeyValuePipe,
    CallComponent,
    TranslateModule
  ],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent {

  roomInfo: RoomInfo;
  joinForm: FormGroup;

  constructor(public webRTCService: WebRTCService, private route: ActivatedRoute, private router: Router, private translate: TranslateService) {
  }

  ngOnInit(): void {
    this.joinForm = new FormGroup({
      name: new FormControl(this.translate.instant('room.roomNamePlaceholder'), {nonNullable: true}),
      password: new FormControl('', {nonNullable: true}),
      username: new FormControl('', Validators.required)
    });

    this.webRTCService.connected.subscribe(connected => {

      if (connected) {
        this.route.paramMap.subscribe(async params => {
          const roomId = params.get('roomId');

          if (roomId) {
            this.roomInfo = await this.webRTCService.getRoomInfo(roomId)
            if (this.roomInfo.hasPassword) {
              this.joinForm.get('password')?.addValidators(Validators.required);
              this.joinForm.get('password')?.updateValueAndValidity();
            }

            if (!this.roomInfo.hasName) {
              this.joinForm.get('name')?.addValidators(Validators.required);
              this.joinForm.get('name')?.updateValueAndValidity();
            }

          } else {
            this.router.navigate([RouteNames.HOME])
          }
        });
      }
    });
  }

  startCall() {
    const room = {
      id: this.roomInfo.id,
      name: this.joinForm.get('name')?.value,
      password: this.joinForm.get('password')?.value
    }
    this.webRTCService.startCall(room, this.joinForm.get('username')?.value);
  }

  hide = signal(true);

  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
}

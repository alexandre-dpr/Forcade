import { Component } from '@angular/core';
import {NgIf} from "@angular/common";
import {Router} from "@angular/router";
import {RouteNames} from "../../enum/RouteNames";
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgIf
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  constructor(private router: Router) {
  }

  createRoom() {
    this.router.navigate([RouteNames.ROOM, uuidv4()]);
  }
}

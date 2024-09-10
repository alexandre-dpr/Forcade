import { Routes } from '@angular/router';
import {HomeComponent} from "./pages/home/home.component";
import {RoomComponent} from "./pages/room/room.component";
import {RouteNames} from "./enum/RouteNames";

export const routes: Routes = [
  {
    path: RouteNames.HOME, component: HomeComponent
  },
  {
    path: `${RouteNames.ROOM}/:roomId`, component: RoomComponent
  },
  {
    path: '**', redirectTo: ''
  }
];

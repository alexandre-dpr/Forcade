import { Routes } from '@angular/router';
import {HomeComponent} from "./pages/home/home.component";
import {RoomComponent} from "./pages/room/room.component";
import {RouteNames} from "./enum/RouteNames";
import {TranslationGuard} from "./guards/TranslationGuard";

export const routes: Routes = [
  {
    path: RouteNames.HOME,
    component: HomeComponent,
    canActivate: [TranslationGuard]
  },
  {
    path: `${RouteNames.ROOM}/:roomId`,
    component: RoomComponent,
    canActivate: [TranslationGuard]
  },
  {
    path: '**', redirectTo: ''
  }
];

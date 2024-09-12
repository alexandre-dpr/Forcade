import {Injectable} from '@angular/core';
import {MatSnackBar} from "@angular/material/snack-bar";
import {SnackbarComponent} from "../../components/snackbar/snackbar.component";
import {TSeverity} from "../../interfaces/TSeverity";

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private snackbar: MatSnackBar) {
  }

  public showNotification(message: string, severity: TSeverity, duration: number = 5000) {
    this.snackbar.openFromComponent(SnackbarComponent, {
      data: {
        message: message,
        severity: severity
      }
    })
    setTimeout(() => {
      this.snackbar.dismiss()
    }, duration);
  }
}

import {Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {

  constructor(private translate: TranslateService) {
  }

  static getDefaultLanguage() {
    const browserLang =  navigator.language.split('-')[0];
    return ['en', 'fr'].includes(browserLang) ? browserLang : 'en';
  }

  switchLanguage(language: string) {
    this.translate.use(language);
  }
}

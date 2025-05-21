import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

@Injectable({ providedIn: 'root' })
export class JwtUrlParser {
  parse(rawToken: string) {
    try {
      const decodedToken = jwtDecode(rawToken, undefined);
      const current_time = new Date().getTime() / 1000;
      if (!decodedToken || !decodedToken.exp || current_time > decodedToken.exp) {
        return null;
      }
      return decodedToken;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
}

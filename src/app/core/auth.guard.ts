import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async canActivate() {
    const { data } = await this.auth.getSession();

    if (data.session) {
      return true;
    }

    await this.router.navigate(['/login']);
    return false;
  }
}

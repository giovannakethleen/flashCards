import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './workspace-shell.html',
  styleUrl: './workspace-shell.scss',
})
export class WorkspaceShellComponent {
  signOutError = '';
  mobileMenuOpen = false;

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  get userInitial() {
    const email = this.auth.currentUser()?.email;
    return email?.charAt(0).toUpperCase() ?? '?';
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  async signOut() {
    const { error } = (await this.auth.signOut()) ?? {};

    if (error) {
      this.signOutError = error.message || 'Não foi possível sair da conta.';
      return;
    }

    this.signOutError = '';
    await this.router.navigate(['/login']);
  }
}

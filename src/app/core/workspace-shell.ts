import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="workspace-shell">
      <header class="topbar">
        <a class="brand" routerLink="/dashboard" aria-label="FlashCards - início">
          <img src="icons/icon-512x512.png" alt="" />
          <span>FlashCards</span>
        </a>
        <button
          type="button"
          class="mobile-menu-toggle"
          (click)="toggleMobileMenu()"
          [attr.aria-expanded]="mobileMenuOpen"
          aria-controls="primary-navigation"
          [attr.aria-label]="mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'"
        >
          {{ mobileMenuOpen ? 'Fechar' : 'Menu' }}
        </button>
        <div class="topbar-center">
          <span class="online-dot"></span>
          <span>SEU ESPAÇO DE INGLÊS</span>
        </div>
        <div class="profile">
          <span class="avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="profile-email">{{ auth.currentUser()?.email }}</span>
          <button type="button" class="logout-button" (click)="signOut()">Sair</button>
        </div>
      </header>

      <aside class="sidebar" [class.open]="mobileMenuOpen">
        <nav id="primary-navigation" class="navigation" aria-label="Menu principal">
          <span class="nav-label">MENU</span>
          <a
            class="nav-link"
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="closeMobileMenu()"
          >
            <span aria-hidden="true">⌂</span> Início
          </a>
          <a class="nav-link" routerLink="/review" routerLinkActive="active" (click)="closeMobileMenu()">
            <span aria-hidden="true">◷</span> Estudar
          </a>
          <a class="nav-link" routerLink="/study-plan" routerLinkActive="active" (click)="closeMobileMenu()">
            <span aria-hidden="true">▦</span> Meu plano
          </a>
          <a class="nav-link" routerLink="/generate-cards" routerLinkActive="active" (click)="closeMobileMenu()">
            <span aria-hidden="true">✦</span> Criar com IA
          </a>
          <a
            class="nav-link"
            routerLink="/cards"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="closeMobileMenu()"
          >
            <span aria-hidden="true">▤</span> Minha coleção
          </a>
          <a class="nav-link" routerLink="/cards/new" routerLinkActive="active" (click)="closeMobileMenu()">
            <span aria-hidden="true">＋</span> Adicionar frase
          </a>
        </nav>
      </aside>

      <div class="workspace-content">
        @if (signOutError) {
          <p class="sign-out-error" role="alert">{{ signOutError }}</p>
        }
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      color: #e5e7eb;
      background:
        radial-gradient(ellipse at 68% 12%, rgba(56, 189, 248, 0.08), transparent 34rem), #0b1220;
      font-family: Inter, 'Segoe UI', sans-serif;
    }

    .workspace-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      grid-template-rows: 72px minmax(calc(100vh - 72px), auto);
      min-width: 0;
      min-height: 100vh;
    }

    .topbar {
      position: sticky;
      z-index: 5;
      top: 0;
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 220px 1fr auto;
      align-items: center;
      gap: 1.5rem;
      min-height: 72px;
      padding: 0 2rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(8, 15, 29, 0.92);
      backdrop-filter: blur(18px);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.7rem;
      color: #dbeafe;
      font-size: 0.86rem;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-decoration: none;
      text-transform: uppercase;
    }

    .brand img {
      width: 38px;
      height: 38px;
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 11px;
      object-fit: cover;
    }

    .topbar-center {
      display: flex;
      align-items: center;
      justify-self: center;
      gap: 0.55rem;
      color: #75849a;
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.16em;
    }

    .online-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.75);
    }

    .profile {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.7rem;
      min-width: 0;
    }

    .avatar {
      display: grid;
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 50%;
      background: rgba(56, 189, 248, 0.13);
      color: #7dd3fc;
      font-size: 0.82rem;
      font-weight: 800;
    }

    .profile-email {
      max-width: 240px;
      overflow: hidden;
      color: #94a3b8;
      font-size: 0.78rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    button {
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .logout-button {
      padding: 0.55rem 0.9rem;
      border: 1px solid rgba(96, 165, 250, 0.23);
      border-radius: 9px;
      background: rgba(96, 165, 250, 0.08);
      color: #cbd5e1;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .mobile-menu-toggle {
      display: none;
      min-height: 44px;
      padding: 0.55rem 0.8rem;
      border: 1px solid rgba(96, 165, 250, 0.25);
      border-radius: 9px;
      background: rgba(96, 165, 250, 0.1);
      color: #dbeafe;
      font-weight: 700;
    }

    .logout-button:hover {
      border-color: rgba(56, 189, 248, 0.52);
      color: #bae6fd;
    }

    .sidebar {
      position: sticky;
      top: 72px;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 72px);
      padding: 2rem 1rem 1rem;
      border-right: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(8, 15, 29, 0.55);
    }

    .navigation {
      display: grid;
      gap: 0.45rem;
    }

    .nav-label {
      margin: 0 0 0.65rem 0.75rem;
      color: #596a81;
      font-size: 0.62rem;
      font-weight: 850;
      letter-spacing: 0.16em;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      width: 100%;
      padding: 0.8rem 0.85rem;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: #8b9bb0;
      font-size: 0.81rem;
      font-weight: 650;
      text-align: left;
      text-decoration: none;
      transition: 150ms ease;
    }

    .nav-link span {
      width: 20px;
      color: #64748b;
      font-size: 1.12rem;
      text-align: center;
    }

    .nav-link:hover,
    .nav-link.active {
      border-color: rgba(56, 189, 248, 0.16);
      background: rgba(56, 189, 248, 0.09);
      color: #e0f2fe;
    }

    .nav-link:hover span,
    .nav-link.active span {
      color: #38bdf8;
    }

    .workspace-content {
      min-width: 0;
    }

    .sign-out-error {
      margin: 0;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(248, 113, 113, 0.3);
      background: rgba(127, 29, 29, 0.18);
      color: #fecaca;
    }

    @media (max-width: 900px) {
      .workspace-shell {
        grid-template-columns: 190px minmax(0, 1fr);
      }

      .topbar {
        grid-template-columns: 190px 1fr auto;
        padding-inline: 1.2rem;
      }
    }

    @media (max-width: 700px) {
      .workspace-shell {
        display: block;
        width: 100%;
      }

      .topbar {
        position: sticky;
        display: flex;
        justify-content: space-between;
        min-height: 62px;
        padding: 0 1rem;
      }

      .mobile-menu-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .topbar-center {
        display: none;
      }

      .profile-email {
        display: none;
      }

      .sidebar {
        position: sticky;
        z-index: 4;
        top: 62px;
        display: none;
        height: auto;
        padding: 0.5rem 0.75rem;
        border-right: 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        background: rgba(8, 15, 29, 0.96);
      }

      .sidebar.open {
        display: block;
      }

      .navigation {
        display: grid;
        gap: 0.35rem;
      }

      .nav-label {
        display: none;
      }

      .nav-link {
        min-height: 46px;
        justify-content: flex-start;
        width: 100%;
        padding: 0.65rem 0.75rem;
        font-size: 0.85rem;
        white-space: nowrap;
      }
    }

    @media (max-width: 480px) {
      .brand {
        font-size: 0.76rem;
      }

      .brand img {
        width: 33px;
        height: 33px;
      }

      .logout-button {
        padding: 0.48rem 0.65rem;
        font-size: 0.69rem;
      }

      .mobile-menu-toggle {
        font-size: 0.75rem;
      }
    }
  `,
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

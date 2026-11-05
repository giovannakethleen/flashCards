import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  template: `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="brand">
          <img src="icons/icon-512x512.png" alt="Logo Loop" />
          <span>FlashCards</span>
        </div>
        <h1>
          @if (mode === 'login') {
            Entrar
          } @else if (mode === 'signup') {
            Criar conta
          } @else {
            Recuperar senha
          }
        </h1>

        @if (errorMessage) {
          <p class="message error" role="alert" aria-live="assertive">{{ errorMessage }}</p>
        }

        @if (successMessage) {
          <p class="message success">{{ successMessage }}</p>
        }

        <label>
          <span>E-mail</span>
          <input type="email" [(ngModel)]="email" placeholder="nome@email.com" />
        </label>

        @if (mode !== 'reset') {
          <label>
            <span>Senha</span>
            <input type="password" [(ngModel)]="password" placeholder="Sua senha" />
          </label>
        }

        <button type="button" class="primary" (click)="submit()" [disabled]="isSubmitting">
          {{
            mode === 'login'
              ? 'Entrar'
              : mode === 'signup'
                ? 'Criar conta'
                : 'Enviar link de recuperação'
          }}
        </button>

        <div class="links">
          @if (mode !== 'login') {
            <button type="button" class="link" (click)="switchMode('login')">Já tenho conta</button>
          }

          @if (mode !== 'signup') {
            <button type="button" class="link" (click)="switchMode('signup')">Criar nova conta</button>
          }

          @if (mode !== 'reset') {
            <button type="button" class="link" (click)="switchMode('reset')">Esqueci a senha</button>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #0b1220 0%, #111827 100%);
      font-family: Arial, sans-serif;
      color: #e5e7eb;
    }

    .auth-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .auth-card {
      width: min(100%, 420px);
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(96, 165, 250, 0.25);
      padding: 2rem 1.5rem;
      border-radius: 18px;
      box-shadow: 0 24px 50px rgba(2, 6, 23, 0.45);
    }

    .eyebrow {
      margin: 0 0 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.72rem;
      font-weight: 700;
      color: #60a5fa;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      color: #60a5fa;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .brand img {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      object-fit: cover;
    }

    h1 {
      margin: 0 0 1rem;
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      color: #e5e7eb;
    }

    label {
      display: block;
      margin-top: 1rem;
      font-weight: 600;
    }

    input {
      width: 100%;
      margin-top: 0.5rem;
      box-sizing: border-box;
      padding: 0.85rem 0.95rem;
      border-radius: 12px;
      border: 1px solid rgba(96, 165, 250, 0.35);
      background: rgba(15, 23, 42, 0.7);
      color: #e5e7eb;
      font-size: 1rem;
    }

    button {
      cursor: pointer;
      border: none;
      font: inherit;
    }

    .primary {
      width: 100%;
      margin-top: 1.25rem;
      background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%);
      color: #0b1220;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      font-weight: 700;
    }

    .primary:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-top: 1rem;
    }

    .link {
      background: transparent;
      color: #dbeafe;
      padding: 0;
      text-decoration: underline;
    }

    .message {
      margin: 0 0 0.75rem;
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      font-size: 0.95rem;
    }

    .error {
      background: #fef2f2;
      color: #b91c1c;
    }

    .success {
      background: #ecfdf5;
      color: #166534;
    }
  `,
  imports: [FormsModule],
})
export class AuthPageComponent {
  mode: 'login' | 'signup' | 'reset' = 'login';
  email = '';
  password = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  switchMode(nextMode: 'login' | 'signup' | 'reset') {
    this.mode = nextMode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  async submit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Informe seu e-mail.';
      return;
    }

    if (this.mode !== 'reset' && !this.password.trim()) {
      this.errorMessage = 'Informe sua senha.';
      return;
    }

    this.isSubmitting = true;

    try {
      if (this.mode === 'login') {
        const { error } = await this.auth.signIn(this.email.trim(), this.password);

        if (error) {
          this.errorMessage = this.getAuthErrorMessage(error.message);
          return;
        }

        await this.router.navigate(['/dashboard']);
        return;
      }

      if (this.mode === 'signup') {
        const { error } = await this.auth.signUp(this.email.trim(), this.password);

        if (error) {
          this.errorMessage = this.getAuthErrorMessage(error.message);
          return;
        }

        this.successMessage =
          'Cadastro enviado. Se a confirmação de e-mail estiver ativa no Supabase, confirme seu endereço antes de entrar.';
        this.mode = 'login';
        this.password = '';
        return;
      }

      const { error } = await this.auth.resetPassword(this.email.trim());

      if (error) {
        this.errorMessage = this.getAuthErrorMessage(error.message);
        return;
      }

      this.successMessage = 'Link de recuperação enviado para o seu e-mail.';
      this.email = '';
      this.password = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.errorMessage = this.getAuthErrorMessage(message);
    } finally {
      this.isSubmitting = false;
    }
  }

  private getAuthErrorMessage(message: string) {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos. Confira os dados ou crie uma conta.';
    }

    if (normalizedMessage.includes('email not confirmed')) {
      return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
    }

    if (normalizedMessage.includes('user already registered')) {
      return 'Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.';
    }

    if (normalizedMessage.includes('password should be at least')) {
      return 'A senha não atende ao tamanho mínimo configurado no Supabase.';
    }

    if (
      normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('fetch')
    ) {
      return 'Não foi possível conectar ao Supabase. Verifique sua internet e a configuração do projeto.';
    }

    return message || 'Não foi possível concluir a operação. Tente novamente.';
  }
}

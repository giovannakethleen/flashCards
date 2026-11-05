import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
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

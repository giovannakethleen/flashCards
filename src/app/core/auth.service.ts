import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<User | null>(null);

  constructor() {
    const client = getSupabaseClient();

    if (!client) {
      return;
    }

    client.auth.onAuthStateChange((_event, session) => {
      this.syncSession(session);
    });

    client.auth.getSession().then(({ data }) => {
      this.syncSession(data.session);
    });
  }

  private syncSession(session: Session | null) {
    this.isAuthenticated.set(Boolean(session));
    this.currentUser.set(session?.user ?? null);
  }

  async getSession() {
    const client = getSupabaseClient();

    if (!client) {
      return { data: { session: null }, error: null };
    }

    return client.auth.getSession();
  }

  async signUp(email: string, password: string) {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env ou no ambiente de build.');
    }

    return client.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env ou no ambiente de build.');
    }

    return client.auth.signInWithPassword({ email, password });
  }

  async resetPassword(email: string) {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no arquivo .env ou no ambiente de build.');
    }

    return client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
  }

  async signOut() {
    const client = getSupabaseClient();

    if (!client) {
      return;
    }

    return client.auth.signOut();
  }
}

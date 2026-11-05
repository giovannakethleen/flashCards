import { Routes } from '@angular/router';

import { AuthPageComponent } from './auth/auth-page';
import { CardListComponent } from './cards/card-list';
import { QuickCardFormComponent } from './cards/quick-card-form';
import { ReviewComponent } from './review/review';
import { AuthGuard } from './core/auth.guard';
import { DashboardComponent } from './dashboard/dashboard';
import { WorkspaceShellComponent } from './core/workspace-shell';
import { StudyPlanComponent } from './study-plan/study-plan';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: AuthPageComponent },
  {
    path: '',
    component: WorkspaceShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'cards', component: CardListComponent },
      { path: 'cards/new', component: QuickCardFormComponent },
      { path: 'review', component: ReviewComponent },
      { path: 'study-plan', component: StudyPlanComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/login' },
];

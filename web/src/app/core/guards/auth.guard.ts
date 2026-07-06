import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProvisioningService } from '../services/provisioning.service';

/** Blocks access to game routes unless a user is logged in. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Redirects already-logged-in users away from the login screen. */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/play']) : true;
};

/** Sends visitors to the setup screen until the site has been provisioned. */
export const provisionGuard: CanActivateFn = async () => {
  const prov = inject(ProvisioningService);
  const router = inject(Router);
  return (await prov.isProvisioned()) ? true : router.createUrlTree(['/setup']);
};

/** Keeps the setup screen for unprovisioned sites; sends provisioned ones to login. */
export const setupGuard: CanActivateFn = async () => {
  const prov = inject(ProvisioningService);
  const router = inject(Router);
  return (await prov.isProvisioned()) ? router.createUrlTree(['/login']) : true;
};

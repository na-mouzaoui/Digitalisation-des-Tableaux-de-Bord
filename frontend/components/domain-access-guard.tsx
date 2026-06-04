"use client";

import { isDomainAllowed } from "@/lib/domain-map";
import type { DomainKey } from "@/lib/tableau-domain-steps";
import type { User } from "@/lib/db";
import { AccessDeniedDialog } from "@/components/access-denied-dialog";

interface DomainAccessGuardProps {
  user: User;
  domainKey: DomainKey;
  children: React.ReactNode;
}

export function DomainAccessGuard({ user, domainKey, children }: DomainAccessGuardProps) {
  const allowedDomaines = user.allowedDomaines ?? [];

  if (allowedDomaines.length > 0 && !isDomainAllowed(domainKey, allowedDomaines)) {
    return (
      <AccessDeniedDialog
        title="Accès refusé"
        message="Vous n'êtes pas autorisé à accéder à ce domaine."
        redirectTo="/dashbord"
      />
    );
  }

  return <>{children}</>;
}

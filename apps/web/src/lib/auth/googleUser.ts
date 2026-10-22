import { db } from '@/lib/db';
import type { User } from '@prisma/client';

interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

// Shared by both the web redirect flow (src/app/api/auth/google/callback)
// and the native mobile flow (src/app/api/auth/google/mobile) — the two
// differ only in how they obtain a verified Google profile, not in what
// happens once they have one.
/**
 * Google sign-in for an email that already has a password account. Linking
 * them automatically would let anyone who registered that email first (email
 * isn't verified at sign-up) keep a password into the real owner's account.
 */
export class GooglePasswordAccountError extends Error {
  constructor() {
    super('This email already has a password — sign in with it.');
  }
}

export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
  let user = await db.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    const firstName = profile.name?.split(' ')[0] || 'User';

    const { newUser } = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: { name: `${firstName}'s Farm` },
      });
      const newUser = await tx.user.create({
        data: {
          name: profile.name || profile.email,
          email: profile.email,
          googleId: profile.sub,
          password: null,
          role: 'owner',
          tenantId: newTenant.id,
        },
      });
      return { newTenant, newUser };
    });

    user = newUser;
  } else if (!user.googleId) {
    if (user.password) throw new GooglePasswordAccountError();
    user = await db.user.update({
      where: { id: user.id },
      data: { googleId: profile.sub },
    });
  }

  return user;
}

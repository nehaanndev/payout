// next-auth.d.ts
import "next-auth"; // Only import the module to augment types

declare module "next-auth" {
  interface Session {
    accessToken: string; // Add the accessToken to the session
  }

  interface User {
    accessToken: string; // Optionally add it to the user if needed
  }
}

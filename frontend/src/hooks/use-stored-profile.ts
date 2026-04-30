import { useState } from "react";
import type { UserProfile } from "@/features/app/types";

export function useStoredProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem("route-parcels-profile");
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  });

  const save = (next: UserProfile | null) => {
    setProfile(next);
    if (next) {
      localStorage.setItem("route-parcels-profile", JSON.stringify(next));
      return;
    }
    localStorage.removeItem("route-parcels-profile");
  };

  return [profile, save] as const;
}

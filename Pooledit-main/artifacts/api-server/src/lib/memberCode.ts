// Internal storage code derived from registration order (the serial id). First
// registrant = ART00001. Used for stable, immutable references — per-member data
// folders (data/members/ART#####/) and audit fallbacks. Not the member-facing ID.
export function memberCode(id: number): string {
  return `ART${String(id).padStart(5, "0")}`;
}

// Member-facing ID (รหัสสมาชิกประจำตัว) is the registrant's phone number.
// Falls back to the internal storage code if no phone is on file.
export function displayMemberCode(user: { id: number; phone?: string | null }): string {
  return user.phone?.trim() || memberCode(user.id);
}

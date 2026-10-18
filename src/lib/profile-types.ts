export type ProfilePayload = {
  full_name: string;
  headline: string;
  bio_vi: string;
  bio_en: string;
  current_country: string;
  study_status: string;
  location: string;
  public_profile: boolean;
  expertise: string[];
  help: string[];
  education: { school: string; faculty: string; degree: string; grad_year: string }[];
  positions: { company: string; job: string; is_current: boolean }[];
  contacts: { email: string; phone: string; linkedin: string; facebook: string; zalo: string };
};

export const STUDY_STATUSES = ["planning", "studying", "graduated", "working_abroad", "returned"] as const;
export type SaveResult = { ok: true; slug: string } | { ok: false; error: "unauth" | "nameRequired" | "tooLong" | "generic" };

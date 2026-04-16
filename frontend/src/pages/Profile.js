import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import {
  CheckCircleIcon,
  ClockIcon,
  CreditIcon,
  LayersIcon,
  ProgressRing,
  RatingStars,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
} from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

function emptyForm() {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  };
}

function buildForm(profile) {
  return {
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
  };
}

function getProfileError(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "We could not save your profile right now.";
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  if (typeof firstField === "string") {
    return firstField;
  }

  return "We could not save your profile right now.";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString();
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProfilePicture, setSelectedProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);

  useRevealOnScroll();

  useEffect(() => {
    let isMounted = true;

    API.get("profile/")
      .then((res) => {
        if (!isMounted) {
          return;
        }

        setProfile(res.data);
        setForm(buildForm(res.data));
        setError("");
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) {
          setError("We could not load your profile right now.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfilePicture) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedProfilePicture);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedProfilePicture]);

  const initials = useMemo(() => {
    const source = profile?.full_name || profile?.username || "User";
    return (
      source
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [profile]);

  const displayName = profile?.full_name || profile?.username || "Your profile";
  const liveProfilePicture = removeProfilePicture ? "" : previewUrl || profile?.profile_picture_url || "";
  const trustGaugeValue = Math.min(100, Math.max(0, (Number(profile?.trust_score || 0) / 5) * 100));

  const startEditing = () => {
    if (!profile) {
      return;
    }

    setForm(buildForm(profile));
    setSelectedProfilePicture(null);
    setRemoveProfilePicture(false);
    setSaveError("");
    setSaveMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (!profile) {
      return;
    }

    setForm(buildForm(profile));
    setSelectedProfilePicture(null);
    setRemoveProfilePicture(false);
    setSaveError("");
    setSaveMessage("");
    setIsEditing(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSaveError("Please choose a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setSelectedProfilePicture(file);
    setRemoveProfilePicture(false);
    setSaveError("");
  };

  const handleRemoveProfilePicture = () => {
    setSelectedProfilePicture(null);
    setRemoveProfilePicture(true);
    setSaveError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setSaveError("");
      setSaveMessage("");

      const payload = new FormData();
      payload.append("first_name", form.first_name.trim());
      payload.append("last_name", form.last_name.trim());
      payload.append("email", form.email.trim());
      payload.append("phone", form.phone.trim());

      if (selectedProfilePicture) {
        payload.append("profile_picture", selectedProfilePicture);
      }

      if (removeProfilePicture) {
        payload.append("remove_profile_picture", "true");
      }

      const res = await API.patch("profile/", payload);
      setProfile(res.data);
      setForm(buildForm(res.data));
      setSelectedProfilePicture(null);
      setRemoveProfilePicture(false);
      setIsEditing(false);
      setSaveMessage("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setSaveError(getProfileError(err.response?.data));
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-900 shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sv-page">
        <div className="sv-container max-w-6xl space-y-6">
          <section className="sv-dark-hero">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="space-y-4">
                <div className="sv-skeleton h-5 w-20" />
                <div className="flex items-center gap-4">
                  <div className="sv-skeleton h-24 w-24 rounded-[28px]" />
                  <div className="space-y-3">
                    <div className="sv-skeleton h-10 w-56 rounded-[20px]" />
                    <div className="sv-skeleton h-4 w-32" />
                    <div className="flex gap-2">
                      <div className="sv-skeleton h-8 w-24 rounded-full" />
                      <div className="sv-skeleton h-8 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="sv-skeleton-card space-y-4">
                    <div className="sv-skeleton h-4 w-24" />
                    <div className="sv-skeleton h-10 w-36 rounded-[18px]" />
                    <div className="sv-skeleton h-20 w-full rounded-[22px]" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="sv-skeleton-card space-y-4">
              <div className="sv-skeleton h-4 w-24" />
              <div className="sv-skeleton h-8 w-52 rounded-[18px]" />
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="sv-skeleton h-16 w-full rounded-[20px]" />
              ))}
            </div>
            <div className="sv-skeleton-card space-y-4">
              <div className="sv-skeleton h-4 w-24" />
              <div className="sv-skeleton h-8 w-40 rounded-[18px]" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="sv-skeleton h-24 w-full rounded-[22px]" />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="sv-container max-w-6xl space-y-6">
        <section className="sv-dark-hero sv-reveal">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <ProfileAvatar imageUrl={liveProfilePicture} initials={initials} size="large" />

              <div>
                <p className="sv-eyebrow-on-dark">Profile</p>
                <h1 className="sv-display-on-dark mt-3">{displayName}</h1>
                <p className="mt-3 text-sm text-slate-300 md:text-base">@{profile.username}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                      profile.is_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {profile.is_verified ? "Verified member" : "Verification pending"}
                  </span>
                  <span className="sv-chip-dark">Joined {formatDate(profile.date_joined)}</span>
                  <span className="sv-chip-dark">{profile.has_profile_picture ? "Photo added" : "Photo missing"}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
                  <span className="sv-icon-chip bg-white/10 text-white">
                    <ShieldIcon className="h-4 w-4" />
                    Trust-first profile
                  </span>
                  <span className="sv-icon-chip bg-white/10 text-white">
                    <SparkIcon className="h-4 w-4" />
                    Shared-cost host ready
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 sv-stagger">
              <MetricCard label="Wallet balance" value={formatCurrency(profile.wallet_balance)} dark />
              <MetricCard
                label="Profile completion"
                value={`${profile.profile_completion}%`}
                dark
                footer={
                  <div className="mt-4 flex items-center gap-4">
                    <ProgressRing value={profile.profile_completion} size={82} stroke={7} label={`${profile.profile_completion}%`} />
                    <div className="text-sm leading-7 text-slate-300">
                      Keep your photo, email, and phone current to make your account feel more complete and trusted.
                    </div>
                  </div>
                }
              />
              <MetricCard
                label="Trust score"
                value={`${Number(profile.trust_score).toFixed(1)} / 5.0`}
                dark
                footer={
                  <div className="mt-4 flex items-center gap-4">
                    <ProgressRing value={trustGaugeValue} size={82} stroke={7} label={Number(profile.trust_score).toFixed(1)} />
                    <div className="text-sm leading-7 text-slate-300">
                      Built from profile quality, healthy wallet activity, and successful group participation.
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sv-reveal sm:flex sm:flex-wrap sm:gap-3">
          <button type="button" className="sv-btn-primary" onClick={() => navigate("/wallet")}>
            <WalletIcon className="h-4 w-4" />
            Open wallet
          </button>
          <button type="button" className="sv-btn-secondary" onClick={() => navigate("/my-shared")}>
            <LayersIcon className="h-4 w-4" />
            My splits
          </button>
          <button type="button" className="sv-btn-secondary" onClick={() => navigate("/create")}>
            <SparkIcon className="h-4 w-4" />
            Create split
          </button>
        </section>

        {saveMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {saveMessage}
          </div>
        ) : null}
        {saveError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {saveError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="sv-card space-y-6 sv-reveal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="sv-eyebrow">Identity</p>
                <h2 className="sv-title mt-2">Personal details</h2>
              </div>
              {!isEditing ? (
                <button type="button" className="sv-btn-secondary" onClick={startEditing}>
                  Edit profile
                </button>
              ) : null}
            </div>

            {isEditing ? (
              <form className="space-y-5 sv-stagger" onSubmit={handleSubmit}>
                <div className="sv-glass-card p-4 md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <ProfileAvatar imageUrl={liveProfilePicture} initials={initials} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Profile picture</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Upload a clear image up to 5 MB. This helps your profile feel more trusted and complete.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <label className="sv-btn-secondary cursor-pointer">
                          Upload photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureChange} />
                        </label>
                        {(selectedProfilePicture || profile.has_profile_picture) && !removeProfilePicture ? (
                          <button type="button" className="sv-btn-secondary" onClick={handleRemoveProfilePicture}>
                            Remove photo
                          </button>
                        ) : null}
                      </div>

                      {selectedProfilePicture ? (
                        <p className="mt-3 text-xs text-slate-500">Ready to upload: {selectedProfilePicture.name}</p>
                      ) : removeProfilePicture ? (
                        <p className="mt-3 text-xs text-amber-700">The current photo will be removed when you save.</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    First name
                    <input
                      className="sv-input"
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Enter first name"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Last name
                    <input
                      className="sv-input"
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Enter last name"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Email
                  <input
                    className="sv-input"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Phone
                  <input
                    className="sv-input"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" className="sv-btn-secondary" onClick={cancelEditing}>
                    Cancel
                  </button>
                  <button type="submit" className="sv-btn-primary" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 sv-stagger">
                <InfoRow
                  icon={CheckCircleIcon}
                  label="Full name"
                  value={profile.full_name || "Add your name to complete your profile"}
                />
                <InfoRow icon={SparkIcon} label="Username" value={`@${profile.username}`} />
                <InfoRow icon={CreditIcon} label="Email" value={profile.email || "Add an email address"} />
                <InfoRow icon={ClockIcon} label="Phone" value={profile.phone || "Add a phone number"} />
                <InfoRow
                  icon={ShieldIcon}
                  label="Profile photo"
                  value={profile.has_profile_picture ? "Added to your account" : "Add a photo to make your profile more complete"}
                />
              </div>
            )}

            <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5">
              <p className="sv-eyebrow">Trust score</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <ProgressRing value={trustGaugeValue} size={92} stroke={8} label={Number(profile.trust_score).toFixed(1)} />
                <div>
                  <h3 className="text-2xl font-bold text-slate-950">{Number(profile.trust_score).toFixed(1)} / 5.0</h3>
                  <p className="mt-3 text-sm leading-7 text-amber-950">
                    Keep your contact details current, maintain healthy wallet activity, and complete successful groups to strengthen trust on ShareVerse.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <section className="sv-card sv-reveal">
              <p className="sv-eyebrow">Activity</p>
              <h2 className="sv-title mt-2">Platform summary</h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 sv-stagger">
                <StatCard label="Groups joined" value={profile.groups_joined} icon={LayersIcon} />
                <StatCard label="Groups created" value={profile.groups_created} icon={SparkIcon} />
                <StatCard label="Active memberships" value={profile.active_memberships} icon={CheckCircleIcon} />
                <StatCard label="Active hosting" value={profile.active_hosting} icon={ShieldIcon} />
              </div>

              <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-white/80 p-5">
                <SummaryRow label="Total spent" value={formatCurrency(profile.total_spent)} tone="negative" />
                <SummaryRow label="Total earned from sharing" value={formatCurrency(profile.total_earned)} tone="positive" />
                <SummaryRow label="Sharing groups created" value={profile.sharing_groups_created} />
                <SummaryRow label="Buy-together groups created" value={profile.buy_together_groups_created} />
              </div>
            </section>

            <section className="sv-card sv-reveal">
              <p className="sv-eyebrow">Reputation</p>
              <h2 className="sv-title mt-2">Recent ratings</h2>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Average rating</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {profile.review_count
                        ? `${profile.review_count} review${profile.review_count === 1 ? "" : "s"} from split activity`
                        : "No public ratings yet"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-950">
                      {profile.average_rating ? Number(profile.average_rating).toFixed(1) : "0.0"}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <RatingStars rating={profile.average_rating || 0} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {profile.recent_reviews?.length ? (
                  profile.recent_reviews.map((review) => (
                    <article key={review.id} className="rounded-[22px] border border-slate-200 bg-white/80 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-950">
                            {review.rating} / 5 from @{review.reviewer_username}
                          </p>
                          <div className="mt-2">
                            <RatingStars rating={review.rating} />
                          </div>
                        </div>
                        <span className="sv-icon-chip bg-slate-100 text-slate-700">
                          <CheckCircleIcon className="h-4 w-4" />
                          Rated
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {review.group_name} | {formatDate(review.created_at)}
                      </p>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="sv-empty-state">
                    <div className="sv-empty-icon">
                      <ClockIcon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      No ratings yet. They will appear here once people review your split experience.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </section>
        </section>
      </div>
    </div>
  );
}

function ProfileAvatar({ imageUrl, initials, size = "default" }) {
  const sizeClasses =
    size === "large"
      ? "h-24 w-24 rounded-[28px] text-3xl md:h-28 md:w-28 md:text-4xl"
      : "h-20 w-20 rounded-[24px] text-2xl";

  return imageUrl ? (
    <img
      src={imageUrl}
      alt="Profile"
      className={`${sizeClasses} border border-white/20 object-cover shadow-[0_18px_45px_rgba(15,23,42,0.18)]`}
    />
  ) : (
    <div
      className={`${sizeClasses} flex items-center justify-center bg-[linear-gradient(135deg,#fbbf24_0%,#fb7185_100%)] font-extrabold text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.18)]`}
    >
      {initials}
    </div>
  );
}

function MetricCard({ label, value, footer, dark = false }) {
  return (
    <article className={dark ? "rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur" : "sv-stat-card"}>
      <p className={dark ? "text-xs uppercase tracking-[0.18em] text-slate-300" : "text-xs uppercase tracking-[0.18em] text-slate-500"}>
        {label}
      </p>
      <p className={dark ? "mt-3 text-3xl font-bold text-white" : "mt-3 text-3xl font-bold text-slate-950"}>
        {value}
      </p>
      {footer}
    </article>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
        {Icon ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950 md:text-base">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <article className="sv-stat-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
        {Icon ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function SummaryRow({ label, value, tone = "default" }) {
  const valueClass =
    tone === "positive"
      ? "font-semibold text-emerald-700"
      : tone === "negative"
        ? "font-semibold text-rose-700"
        : "font-semibold text-slate-950";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

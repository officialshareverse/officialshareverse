import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";

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
        <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="sv-container max-w-6xl space-y-6">
        <section className="sv-dark-hero">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <ProfileAvatar imageUrl={liveProfilePicture} initials={initials} size="large" />

              <div>
                <p className="sv-eyebrow-on-dark">Profile</p>
                <h1 className="sv-display-on-dark mt-3">{displayName}</h1>
                <p className="mt-3 text-sm text-slate-300 md:text-base">@{profile.username}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${profile.is_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {profile.is_verified ? "Verified member" : "Verification pending"}
                  </span>
                  <span className="sv-chip-dark">Joined {formatDate(profile.date_joined)}</span>
                  <span className="sv-chip-dark">{profile.has_profile_picture ? "Photo added" : "Photo missing"}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <MetricCard label="Wallet balance" value={formatCurrency(profile.wallet_balance)} dark />
              <MetricCard
                label="Profile completion"
                value={`${profile.profile_completion}%`}
                dark
                footer={
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#34d399_0%,#fbbf24_100%)]"
                      style={{ width: `${profile.profile_completion}%` }}
                    />
                  </div>
                }
              />
              <MetricCard
                label="Community rating"
                value={profile.average_rating ? `${Number(profile.average_rating).toFixed(1)} / 5` : "New"}
                dark
                footer={
                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    {profile.review_count
                      ? `${profile.review_count} review${profile.review_count === 1 ? "" : "s"} from group activity`
                      : "Ratings will appear here after group activity."}
                  </p>
                }
              />
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <button type="button" className="sv-btn-primary" onClick={() => navigate("/wallet")}>
            Open wallet
          </button>
          <button type="button" className="sv-btn-secondary" onClick={() => navigate("/my-shared")}>
            My groups
          </button>
          <button type="button" className="sv-btn-secondary" onClick={() => navigate("/create")}>
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
          <section className="sv-card space-y-6">
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
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 md:p-5">
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
              <div className="space-y-4">
                <InfoRow label="Full name" value={profile.full_name || "Add your name to complete your profile"} />
                <InfoRow label="Username" value={`@${profile.username}`} />
                <InfoRow label="Email" value={profile.email || "Add an email address"} />
                <InfoRow label="Phone" value={profile.phone || "Add a phone number"} />
                <InfoRow label="Profile photo" value={profile.has_profile_picture ? "Added to your account" : "Add a photo to make your profile more complete"} />
              </div>
            )}

            <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5">
              <p className="sv-eyebrow">Trust score</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-950">{Number(profile.trust_score).toFixed(1)} / 5.0</h3>
              <p className="mt-3 text-sm leading-7 text-amber-950">
                Keep your contact details current, maintain healthy wallet activity, and complete successful groups to strengthen trust on ShareVerse.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <section className="sv-card">
              <p className="sv-eyebrow">Activity</p>
              <h2 className="sv-title mt-2">Platform summary</h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <StatCard label="Groups joined" value={profile.groups_joined} />
                <StatCard label="Groups created" value={profile.groups_created} />
                <StatCard label="Active memberships" value={profile.active_memberships} />
                <StatCard label="Active hosting" value={profile.active_hosting} />
              </div>

              <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-white/80 p-5">
                <SummaryRow label="Total spent" value={formatCurrency(profile.total_spent)} tone="negative" />
                <SummaryRow label="Total earned from sharing" value={formatCurrency(profile.total_earned)} tone="positive" />
                <SummaryRow label="Sharing groups created" value={profile.sharing_groups_created} />
                <SummaryRow label="Buy-together groups created" value={profile.buy_together_groups_created} />
              </div>
            </section>

            <section className="sv-card">
              <p className="sv-eyebrow">Reputation</p>
              <h2 className="sv-title mt-2">Recent ratings</h2>

              <div className="mt-5 space-y-4">
                {profile.recent_reviews?.length ? (
                  profile.recent_reviews.map((review) => (
                    <article key={review.id} className="rounded-[22px] border border-slate-200 bg-white/80 p-4">
                      <p className="text-base font-semibold text-slate-950">
                        {review.rating} / 5 from @{review.reviewer_username}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {review.group_name} • {formatDate(review.created_at)}
                      </p>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    No ratings yet. They will appear here once people review your group experience.
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

function InfoRow({ label, value }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950 md:text-base">{value}</p>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="sv-stat-card">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
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

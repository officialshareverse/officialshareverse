import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonList,
  SkeletonMetricGrid,
  SkeletonTextGroup,
} from "../components/SkeletonFactory";
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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getProfileTagline(profile) {
  if (!profile) {
    return "Build a profile people trust before they join your next split.";
  }

  if (profile.is_verified && Number(profile.active_hosting || 0) > 0) {
    return "Verified host with active splits already running smoothly.";
  }

  if (Number(profile.groups_created || 0) > 0) {
    return "Creator profile tuned for smoother hosting, payments, and member trust.";
  }

  if (Number(profile.groups_joined || 0) > 0) {
    return "Reliable member profile built for quick approvals and clearer split history.";
  }

  return "Complete the basics now so future hosts trust you faster.";
}

function getFieldValidation(name, value) {
  const trimmed = String(value || "").trim();

  if (name === "email") {
    if (!trimmed) {
      return { tone: "idle", message: "Recommended for receipts and recovery." };
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? { tone: "valid", message: "Looks ready." }
      : { tone: "invalid", message: "Enter a valid email address." };
  }

  if (name === "phone") {
    if (!trimmed) {
      return { tone: "idle", message: "Recommended for trust and support." };
    }

    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15
      ? { tone: "valid", message: "Phone number looks usable." }
      : { tone: "invalid", message: "Use a 10 to 15 digit phone number." };
  }

  if (!trimmed) {
    return { tone: "idle", message: "Recommended for profile completeness." };
  }

  return { tone: "valid", message: "Looks good." };
}

function buildReviewDistribution(reviews) {
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const total = safeReviews.length || 1;

  return Array.from({ length: 5 }, (_, index) => {
    const rating = 5 - index;
    const count = safeReviews.filter((review) => Number(review.rating) === rating).length;
    return {
      rating,
      count,
      percent: Math.round((count / total) * 100),
    };
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSort, setReviewSort] = useState("newest");

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
  const draftDisplayName = `${form.first_name || ""} ${form.last_name || ""}`.trim() || displayName;
  const liveProfilePicture = removeProfilePicture ? "" : previewUrl || profile?.profile_picture_url || "";
  const trustGaugeValue = clampPercent((Number(profile?.trust_score || 0) / 5) * 100);
  const profileTagline = getProfileTagline(profile);
  const recentReviews = useMemo(
    () => (Array.isArray(profile?.recent_reviews) ? profile.recent_reviews : []),
    [profile?.recent_reviews]
  );
  const averageRating = Number(profile?.average_rating || 0);

  const fieldValidation = useMemo(
    () => ({
      first_name: getFieldValidation("first_name", form.first_name),
      last_name: getFieldValidation("last_name", form.last_name),
      email: getFieldValidation("email", form.email),
      phone: getFieldValidation("phone", form.phone),
    }),
    [form.email, form.first_name, form.last_name, form.phone]
  );

  const profileStrength = useMemo(() => {
    const checks = [
      Boolean(form.first_name.trim()),
      Boolean(form.last_name.trim()),
      Boolean(form.email.trim()) && fieldValidation.email.tone !== "invalid",
      Boolean(form.phone.trim()) && fieldValidation.phone.tone !== "invalid",
      Boolean(liveProfilePicture),
      Boolean(profile?.is_verified),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [fieldValidation.email.tone, fieldValidation.phone.tone, form.email, form.first_name, form.last_name, form.phone, liveProfilePicture, profile?.is_verified]);

  const trustBreakdown = useMemo(() => {
    const profileQuality = clampPercent((Number(profile?.profile_completion || 0) + profileStrength) / 2);
    const walletHealth = Number(profile?.wallet_balance || 0) > 0
      ? clampPercent((Number(profile?.wallet_balance || 0) / 500) * 100)
      : Number(profile?.total_earned || 0) > 0
        ? 58
        : 18;
    const groupHistory = clampPercent(
      Math.min(
        100,
        Number(profile?.groups_joined || 0) * 10 +
          Number(profile?.groups_created || 0) * 12 +
          Number(profile?.review_count || 0) * 8 +
          averageRating * 12
      )
    );

    return [
      {
        label: "Profile quality",
        value: profileQuality,
        note: "Name, contact details, photo, and completion all contribute here.",
      },
      {
        label: "Wallet health",
        value: walletHealth,
        note: "A funded wallet and payout-ready profile help future transactions feel safer.",
      },
      {
        label: "Group history",
        value: groupHistory,
        note: "Completed joins, hosting activity, and reviews strengthen your public track record.",
      },
    ];
  }, [averageRating, profile?.groups_created, profile?.groups_joined, profile?.profile_completion, profile?.review_count, profile?.total_earned, profile?.wallet_balance, profileStrength]);

  const reviewDistribution = useMemo(() => buildReviewDistribution(recentReviews), [recentReviews]);
  const filteredReviews = useMemo(() => {
    let nextReviews = [...recentReviews];

    if (reviewFilter !== "all") {
      nextReviews = nextReviews.filter((review) => String(review.rating) === reviewFilter);
    }

    if (reviewSort === "highest") {
      nextReviews.sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0));
    } else {
      nextReviews.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    }

    return nextReviews;
  }, [recentReviews, reviewFilter, reviewSort]);

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
    setIsDragActive(false);
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

  const processProfilePictureFile = (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSaveError("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Profile picture must be 5 MB or smaller.");
      return;
    }

    setSelectedProfilePicture(file);
    setRemoveProfilePicture(false);
    setSaveError("");
  };

  const handleProfilePictureChange = (event) => {
    processProfilePictureFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleRemoveProfilePicture = () => {
    setSelectedProfilePicture(null);
    setRemoveProfilePicture(true);
    setSaveError("");
  };

  const handleUploadDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    processProfilePictureFile(event.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

     if (fieldValidation.email.tone === "invalid" || fieldValidation.phone.tone === "invalid") {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

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
                <SkeletonBlock className="h-5 w-20" />
                <div className="flex items-center gap-4">
                  <SkeletonBlock className="h-24 w-24 rounded-[28px]" />
                  <div className="space-y-3">
                    <SkeletonBlock className="h-10 w-56 rounded-[20px]" />
                    <SkeletonBlock className="h-4 w-32" />
                    <div className="flex gap-2">
                      <SkeletonBlock className="h-8 w-24 rounded-full" />
                      <SkeletonBlock className="h-8 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <SkeletonMetricGrid count={3} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1" cardClassName="space-y-4" />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <SkeletonCard>
              <SkeletonTextGroup eyebrowWidth="w-24" titleWidth="w-52" bodyWidths={[]} />
              <SkeletonList count={5} className="mt-4 space-y-4" itemClassName="h-16 rounded-[20px]" />
            </SkeletonCard>
            <SkeletonCard>
              <SkeletonTextGroup eyebrowWidth="w-24" titleWidth="w-40" bodyWidths={[]} />
              <SkeletonList count={4} className="mt-4 space-y-4" itemClassName="h-24 rounded-[22px]" />
            </SkeletonCard>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="sv-container max-w-6xl space-y-6">
        <section className="sv-profile-hero sv-reveal">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(290px,0.88fr)]">
            <div className="min-w-0">
              <p className="sv-eyebrow-on-dark">Profile</p>
              <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center">
                <div className="sv-profile-avatar-shell">
                  <ProfileAvatar imageUrl={liveProfilePicture} initials={initials} size="large" />
                  <button
                    type="button"
                    className="sv-profile-avatar-overlay"
                    onClick={() => {
                      if (isEditing) {
                        fileInputRef.current?.click();
                      } else {
                        startEditing();
                      }
                    }}
                  >
                    {isEditing ? "Change photo" : "Edit profile"}
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="sv-display-on-dark">{isEditing ? draftDisplayName : displayName}</h1>
                    <span className={`sv-profile-verify-chip ${profile.is_verified ? "is-verified" : "is-pending"}`}>
                      <ShieldIcon className="h-3.5 w-3.5" />
                      {profile.is_verified ? "Verified" : "Pending"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-200 md:text-base">@{profile.username}</p>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base md:leading-8">
                    {profileTagline}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="sv-chip-dark">Joined {formatDate(profile.date_joined)}</span>
                    <span className="sv-chip-dark">{profile.has_profile_picture ? "Photo added" : "Photo missing"}</span>
                    <span className="sv-chip-dark">{profile.profile_completion}% complete</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <HeroMetricCard
                label="Wallet balance"
                value={formatCurrency(profile.wallet_balance)}
                note="Keep funds ready for paid joins and faster checkouts."
              />
              <HeroMetricCard
                label="Profile strength"
                value={`${profileStrength}%`}
                note="A stronger profile shortens trust checks for new members."
              />
              <HeroMetricCard
                label="Active now"
                value={`${Number(profile.active_memberships || 0) + Number(profile.active_hosting || 0)}`}
                note="Total active memberships and hosted groups right now."
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 sv-reveal">
          <StatCard label="Groups joined" value={profile.groups_joined} icon={LayersIcon} tone="is-teal" note="Member history" />
          <StatCard label="Groups created" value={profile.groups_created} icon={SparkIcon} tone="is-violet" note="Host activity" />
          <StatCard label="Total spent" value={profile.total_spent} icon={CreditIcon} tone="is-rose" note="Across joined groups" format="currency" />
          <StatCard label="Total earned" value={profile.total_earned} icon={WalletIcon} tone="is-emerald" note="From sharing activity" format="currency" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <section className="sv-card sv-reveal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="sv-eyebrow">Identity</p>
                <h2 className="sv-title mt-2">Make your profile feel complete</h2>
              </div>
              {!isEditing ? (
                <button type="button" className="sv-btn-secondary" onClick={startEditing}>
                  Edit profile
                </button>
              ) : null}
            </div>

            <div className="sv-profile-strength-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Profile strength</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {profileStrength >= 80
                      ? "Strong profile - you are covering the essentials."
                      : profileStrength >= 55
                        ? "Good start - a few more details will help."
                        : "Add a few basics to make trust checks smoother."}
                  </p>
                </div>
                <span className="sv-profile-strength-pill">{profileStrength}%</span>
              </div>
              <div className="sv-profile-strength-track">
                <span className="sv-profile-strength-fill" style={{ width: `${Math.max(8, profileStrength)}%` }} />
              </div>
            </div>

            {isEditing ? (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div
                  className={`sv-profile-upload-shell ${isDragActive ? "is-dragging" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (event.currentTarget.contains(event.relatedTarget)) {
                      return;
                    }
                    setIsDragActive(false);
                  }}
                  onDrop={handleUploadDrop}
                >
                  <label htmlFor="sv-profile-upload" className="sv-profile-upload-label">
                    <span className="sv-profile-upload-icon">
                      <SparkIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-950">Drop a profile photo here or click to browse</span>
                      <span className="mt-1 block text-sm leading-7 text-slate-500">
                        JPG, PNG, or WEBP up to 5 MB. A clear photo helps new members trust your profile faster.
                      </span>
                    </span>
                  </label>
                  <input
                    id="sv-profile-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePictureChange}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="sv-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                      Upload photo
                    </button>
                    {(selectedProfilePicture || profile.has_profile_picture) && !removeProfilePicture ? (
                      <button type="button" className="sv-btn-secondary" onClick={handleRemoveProfilePicture}>
                        Remove photo
                      </button>
                    ) : null}
                  </div>

                  {selectedProfilePicture || removeProfilePicture ? (
                    <div className="sv-profile-photo-compare">
                      <PhotoPreviewCard label="Current" imageUrl={profile?.profile_picture_url || ""} initials={initials} />
                      <PhotoPreviewCard
                        label={removeProfilePicture ? "After save" : "New preview"}
                        imageUrl={removeProfilePicture ? "" : liveProfilePicture}
                        initials={initials}
                        note={removeProfilePicture ? "Photo will be removed." : selectedProfilePicture?.name || "Preview"}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ProfileField
                    label="First name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    validation={fieldValidation.first_name}
                  />
                  <ProfileField
                    label="Last name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    validation={fieldValidation.last_name}
                  />
                </div>

                <ProfileField
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  validation={fieldValidation.email}
                />

                <ProfileField
                  label="Phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  validation={fieldValidation.phone}
                />

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
          </section>

          <section className="space-y-6">
            <section className="sv-card sv-reveal">
              <p className="sv-eyebrow">Trust score</p>
              <div className="mt-4 flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-4">
                  <ProgressRing value={trustGaugeValue} size={112} stroke={9} label={Number(profile.trust_score || 0).toFixed(1)} />
                  <div>
                    <h2 className="text-[1.8rem] font-black text-slate-950">{Number(profile.trust_score || 0).toFixed(1)} / 5.0</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      One place to understand how trusted your account feels before someone joins, pays, or hosts with you.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {trustBreakdown.map((item) => (
                    <div key={item.label} className="sv-profile-breakdown-row">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-950">{item.label}</span>
                        <span className="text-sm font-semibold text-slate-500">{item.value}%</span>
                      </div>
                      <div className="sv-profile-breakdown-track">
                        <span className="sv-profile-breakdown-fill" style={{ width: `${Math.max(8, item.value)}%` }} />
                      </div>
                      <p className="text-xs leading-6 text-slate-500">{item.note}</p>
                    </div>
                  ))}
                </div>

                <details className="sv-profile-details-card">
                  <summary>How to improve this</summary>
                  <div className="mt-3 grid gap-3 text-sm leading-7 text-slate-600">
                    <p>Add a clear photo, complete your contact fields, and keep your wallet funded before joining new paid groups.</p>
                    <p>Hosting more successfully and collecting a few positive reviews will strengthen your group-history signal over time.</p>
                  </div>
                </details>
              </div>
            </section>

            <section className="sv-card sv-reveal">
              <p className="sv-eyebrow">Activity snapshot</p>
              <h2 className="sv-title mt-2">What your account is doing</h2>

              <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-white/80 p-5">
                <SummaryRow label="Wallet balance" value={formatCurrency(profile.wallet_balance)} />
                <SummaryRow label="Active memberships" value={profile.active_memberships} />
                <SummaryRow label="Active hosting" value={profile.active_hosting} />
                <SummaryRow label="Sharing groups created" value={profile.sharing_groups_created} />
                <SummaryRow label="Buy-together groups created" value={profile.buy_together_groups_created} />
              </div>
            </section>

            <section className="sv-card sv-reveal">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="sv-eyebrow">Reviews</p>
                  <h2 className="sv-title mt-2">How others rate the experience</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {profile.review_count
                      ? `${profile.review_count} review${profile.review_count === 1 ? "" : "s"} received across your split activity.`
                      : "Reviews will show up here once members rate their experience with you."}
                  </p>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-right">
                  <p className="text-sm font-semibold text-slate-950">Average rating</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{averageRating ? averageRating.toFixed(1) : "0.0"}</p>
                  <div className="mt-2 flex justify-end">
                    <RatingStars rating={averageRating || 0} />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50/90 p-5">
                <p className="text-sm font-semibold text-slate-950">Rating distribution</p>
                <div className="mt-4 space-y-3">
                  {reviewDistribution.map((item) => <ReviewDistributionRow key={item.rating} {...item} />)}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "5", label: "5 stars" },
                    { value: "4", label: "4 stars" },
                    { value: "3", label: "3 stars" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`sv-profile-filter-chip ${reviewFilter === item.value ? "is-active" : ""}`}
                      onClick={() => setReviewFilter(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "newest", label: "Newest" },
                    { value: "highest", label: "Highest rating" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`sv-profile-filter-chip ${reviewSort === item.value ? "is-active" : ""}`}
                      onClick={() => setReviewSort(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {filteredReviews.length ? (
                  filteredReviews.map((review) => <ReviewCard key={review.id} review={review} />)
                ) : (
                  <div className="sv-empty-state">
                    <div className="sv-empty-icon">
                      <ClockIcon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      No reviews match this filter yet.
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
      ? "h-28 w-28 rounded-[32px] text-4xl md:h-32 md:w-32 md:text-[2.75rem]"
      : "h-20 w-20 rounded-[24px] text-2xl";

  return imageUrl ? (
    <img
      src={imageUrl}
      alt="Profile"
      className={`${sizeClasses} border border-white/20 object-cover shadow-[0_20px_50px_rgba(15,23,42,0.24)]`}
    />
  ) : (
    <div
      className={`${sizeClasses} flex items-center justify-center bg-[linear-gradient(135deg,#fbbf24_0%,#fb7185_100%)] font-extrabold text-slate-950 shadow-[0_20px_50px_rgba(15,23,42,0.24)]`}
    >
      {initials}
    </div>
  );
}

function HeroMetricCard({ label, value, note }) {
  return (
    <article className="sv-profile-hero-metric">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{note}</p>
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

function StatCard({ label, value, icon: Icon, tone = "", note = "", format = "number" }) {
  return (
    <article className={`sv-stat-card sv-profile-stat-card ${tone}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
        {Icon ? (
          <span className="sv-profile-stat-icon">
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">
        <AnimatedStatValue value={value} format={format} />
      </p>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
    </article>
  );
}

function AnimatedStatValue({ value, format = "number" }) {
  const targetValue = Number(value || 0);
  const [displayValue, setDisplayValue] = useState(targetValue);

  useEffect(() => {
    const from = displayValue;
    const to = targetValue;

    if (from === to || Number.isNaN(to)) {
      setDisplayValue(to);
      return undefined;
    }

    let animationFrameId = 0;
    const startedAt = performance.now();
    const duration = 650;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [displayValue, targetValue]);

  return format === "currency"
    ? formatCurrency(displayValue)
    : Math.round(displayValue).toLocaleString("en-IN");
}

function ProfileField({ label, name, type = "text", value, onChange, placeholder, validation }) {
  const Icon = validation.tone === "valid" ? CheckCircleIcon : validation.tone === "invalid" ? ClockIcon : SparkIcon;

  return (
    <label className="sv-profile-field">
      <span className="sv-profile-field-label">{label}</span>
      <input
        className={`sv-input ${validation.tone === "invalid" ? "border-rose-300" : ""}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <span className={`sv-profile-field-hint is-${validation.tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {validation.message}
      </span>
    </label>
  );
}

function PhotoPreviewCard({ label, imageUrl, initials, note }) {
  return (
    <div className="sv-profile-photo-card">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <div className="mt-3">
        <ProfileAvatar imageUrl={imageUrl} initials={initials} />
      </div>
      {note ? <p className="mt-3 text-xs leading-6 text-slate-500">{note}</p> : null}
    </div>
  );
}

function ReviewDistributionRow({ rating, count, percent }) {
  return (
    <div className="sv-profile-distribution-row">
      <span className="text-sm font-semibold text-slate-700">{rating} star</span>
      <div className="sv-profile-distribution-track">
        <span className="sv-profile-distribution-fill" style={{ width: `${Math.max(count > 0 ? 10 : 0, percent)}%` }} />
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{count}</span>
    </div>
  );
}

function ReviewCard({ review }) {
  const reviewerInitials =
    review.reviewer_username
      ?.split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "SV";

  return (
    <article className="sv-profile-review-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="sv-profile-review-avatar">{reviewerInitials}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-950">@{review.reviewer_username}</p>
              <span className="sv-profile-review-chip">{review.rating} / 5</span>
            </div>
            <div className="mt-2">
              <RatingStars rating={review.rating} />
            </div>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{formatDate(review.created_at)}</p>
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">{review.group_name}</p>
      {review.comment ? (
        <p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p>
      ) : (
        <p className="mt-3 text-sm leading-7 text-slate-500">No written comment was added with this rating.</p>
      )}
    </article>
  );
}

function SummaryRow({ label, value }) {
  
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

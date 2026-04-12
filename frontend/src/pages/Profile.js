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

function getProfileError(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "We could not save your profile right now.";
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  return "We could not save your profile right now.";
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

  useEffect(() => {
    API.get("profile/")
      .then((res) => {
        setProfile(res.data);
        setForm({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          email: res.data.email || "",
          phone: res.data.phone || "",
        });
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("We could not load your profile right now.");
      });
  }, []);

  const initials = useMemo(() => {
    if (!profile) {
      return "U";
    }

    const source = profile.full_name || profile.username || "User";
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";
  }, [profile]);

  const startEditing = () => {
    if (!profile) {
      return;
    }

    setForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
    });
    setSaveError("");
    setSaveMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (!profile) {
      return;
    }

    setForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
    });
    setSaveError("");
    setSaveMessage("");
    setIsEditing(false);
  };

  const handleChange = (e) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      setSaveError("");
      setSaveMessage("");

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      };

      const res = await API.patch("profile/", payload);
      setProfile(res.data);
      setForm({
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
        phone: res.data.phone || "",
      });
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
    return <div style={stateWrap}><p style={errorText}>{error}</p></div>;
  }

  if (!profile) {
    return <div style={stateWrap}><p>Loading profile...</p></div>;
  }

  return (
    <div style={page}>
      <div style={hero}>
        <div style={heroLeft}>
          <div style={avatar}>{initials}</div>

          <div>
            <p style={eyebrow}>Account overview</p>
            <h1 style={heroTitle}>{profile.full_name || profile.username}</h1>
            <p style={heroSub}>@{profile.username}</p>

            <div style={heroMeta}>
              <span style={statusPill(profile.is_verified)}>
                {profile.is_verified ? "Verified member" : "Verification pending"}
              </span>
              <span style={metaText}>Member since {formatDate(profile.date_joined)}</span>
            </div>
          </div>
        </div>

        <div style={heroRight}>
          <div style={heroStatCard}>
            <p style={statLabel}>Wallet balance</p>
            <p style={statValue}>Rs {profile.wallet_balance}</p>
          </div>

          <div style={heroStatCard}>
            <p style={statLabel}>Profile completion</p>
            <p style={statValue}>{profile.profile_completion}%</p>
            <div style={meterTrack}>
              <div style={{ ...meterFill, width: `${profile.profile_completion}%` }} />
            </div>
          </div>

          <div style={heroStatCard}>
            <p style={statLabel}>Member rating</p>
            <p style={statValue}>
              {profile.average_rating ? `${Number(profile.average_rating).toFixed(1)} / 5` : "New"}
            </p>
            <p style={heroFootnote}>
              {profile.review_count
                ? `${profile.review_count} review${profile.review_count === 1 ? "" : "s"} from group activity`
                : "Your reviews will appear here after group activity"}
            </p>
          </div>
        </div>
      </div>

      <div style={quickActions}>
        <button style={primaryAction} onClick={() => navigate("/wallet")}>Open wallet</button>
        <button style={secondaryAction} onClick={() => navigate("/my-shared")}>Manage my groups</button>
        <button style={secondaryAction} onClick={() => navigate("/create")}>Create new group</button>
      </div>

      <div style={grid}>
        <section style={panel}>
          <div style={sectionHeaderWithAction}>
            <div>
              <p style={sectionEyebrow}>Identity</p>
              <h2 style={sectionTitle}>Personal details</h2>
            </div>

            {!isEditing ? (
              <button style={editButton} onClick={startEditing}>Edit profile</button>
            ) : null}
          </div>

          {saveMessage ? <p style={successText}>{saveMessage}</p> : null}
          {saveError ? <p style={inlineErrorText}>{saveError}</p> : null}

          {isEditing ? (
            <form onSubmit={handleSubmit}>
              <div style={formGrid}>
                <div>
                  <label style={inputLabel}>First name</label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    style={input}
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label style={inputLabel}>Last name</label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    style={input}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={inputLabel}>Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  style={input}
                  placeholder="Enter email address"
                />
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={inputLabel}>Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  style={input}
                  placeholder="Enter phone number"
                />
              </div>

              <div style={formActions}>
                <button type="button" style={cancelButton} onClick={cancelEditing}>
                  Cancel
                </button>
                <button type="submit" style={saveButton} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <InfoRow label="Full name" value={profile.full_name || "Add your name to complete your profile"} />
              <InfoRow label="Username" value={`@${profile.username}`} />
              <InfoRow label="Email" value={profile.email || "Add an email address"} />
              <InfoRow label="Phone" value={profile.phone || "Add a phone number"} />
            </>
          )}

          <div style={trustCard}>
            <div>
              <p style={sectionEyebrow}>Trust score</p>
              <h3 style={{ margin: "6px 0 0" }}>{Number(profile.trust_score).toFixed(1)} / 5.0</h3>
            </div>
            <p style={trustText}>
              Keep a healthy wallet history, successful group activity, and verified contact details to strengthen trust on the platform.
            </p>
            <p style={{ ...trustText, marginTop: "8px" }}>
              Community rating: {profile.average_rating ? `${Number(profile.average_rating).toFixed(1)} / 5` : "No ratings yet"} from {profile.review_count || 0} review{profile.review_count === 1 ? "" : "s"}.
            </p>
          </div>
        </section>

        <section style={panel}>
          <div style={sectionHeader}>
            <div>
              <p style={sectionEyebrow}>Activity</p>
              <h2 style={sectionTitle}>Platform summary</h2>
            </div>
          </div>

          <div style={statsGrid}>
            <StatTile label="Groups joined" value={profile.groups_joined} />
            <StatTile label="Groups created" value={profile.groups_created} />
            <StatTile label="Active memberships" value={profile.active_memberships} />
            <StatTile label="Active hosting" value={profile.active_hosting} />
          </div>

          <div style={financialCard}>
            <div style={financialRow}>
              <span style={financialLabel}>Total spent</span>
              <span style={negativeValue}>Rs {profile.total_spent}</span>
            </div>
            <div style={financialRow}>
              <span style={financialLabel}>Total earned from sharing</span>
              <span style={positiveValue}>Rs {profile.total_earned}</span>
            </div>
            <div style={financialRow}>
              <span style={financialLabel}>Sharing groups created</span>
              <span>{profile.sharing_groups_created}</span>
            </div>
            <div style={financialRow}>
              <span style={financialLabel}>Buy-together groups created</span>
              <span>{profile.buy_together_groups_created}</span>
            </div>
          </div>

          <div style={reviewsCard}>
            <div style={sectionHeader}>
              <div>
                <p style={sectionEyebrow}>Reputation</p>
                <h2 style={sectionTitle}>Recent ratings</h2>
              </div>
            </div>

            {profile.recent_reviews?.length ? (
              profile.recent_reviews.map((review) => (
                <div key={review.id} style={reviewRow}>
                  <div>
                    <p style={reviewRowTitle}>
                      {review.rating} / 5 from @{review.reviewer_username}
                    </p>
                    <p style={reviewRowMeta}>
                      {review.group_name} | {formatDate(review.created_at)}
                    </p>
                    {review.comment ? <p style={reviewRowComment}>{review.comment}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <p style={reviewEmptyText}>No ratings yet. They will appear here once people review your group experience.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={infoRow}>
      <p style={infoLabel}>{label}</p>
      <p style={infoValue}>{value}</p>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={statTile}>
      <p style={statTileLabel}>{label}</p>
      <p style={statTileValue}>{value}</p>
    </div>
  );
}

function formatDate(date) {
  if (!date) {
    return "";
  }
  return new Date(date).toLocaleDateString();
}

const page = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(15,118,110,0.10), transparent 28%), radial-gradient(circle at bottom right, rgba(187,122,20,0.10), transparent 24%), linear-gradient(180deg, #f7f2e9 0%, #eef3f6 100%)",
  padding: "32px",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  gap: "24px",
  flexWrap: "wrap",
  background: "linear-gradient(145deg, #0f172a 0%, #162033 50%, #0f766e 100%)",
  color: "#fff",
  borderRadius: "32px",
  padding: "28px",
  boxShadow: "0 34px 90px rgba(15, 23, 42, 0.20)",
};

const heroLeft = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
};

const avatar = {
  width: "88px",
  height: "88px",
  borderRadius: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "30px",
  fontWeight: 800,
  background: "linear-gradient(135deg, #fbbf24 0%, #fb7185 100%)",
  color: "#111827",
};

const eyebrow = {
  margin: 0,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.22em",
  color: "#fcd34d",
};

const heroTitle = {
  margin: "8px 0 0",
  fontSize: "40px",
  lineHeight: 1,
  fontWeight: 800,
};

const heroSub = {
  margin: "6px 0 0",
  color: "#cbd5e1",
};

const heroMeta = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
  alignItems: "center",
};

const metaText = {
  color: "#cbd5e1",
  fontSize: "14px",
};

const heroRight = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  flex: 1,
  minWidth: "260px",
};

const heroStatCard = {
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "22px",
  padding: "18px",
  backdropFilter: "blur(12px)",
};

const statLabel = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "13px",
};

const statValue = {
  margin: "8px 0 0",
  fontSize: "30px",
  fontWeight: 800,
};

const heroFootnote = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.5,
};

const meterTrack = {
  marginTop: "12px",
  height: "8px",
  background: "rgba(255,255,255,0.18)",
  borderRadius: "999px",
  overflow: "hidden",
};

const meterFill = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #34d399 0%, #fbbf24 100%)",
};

const quickActions = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "18px",
  marginBottom: "22px",
};

const primaryAction = {
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #1f3a4a 100%)",
  color: "#fff",
  borderRadius: "999px",
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.14)",
};

const secondaryAction = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255,255,255,0.84)",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px",
};

const panel = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: "30px",
  padding: "24px",
  boxShadow: "0 26px 70px rgba(15, 23, 42, 0.08)",
  border: "1px solid rgba(255,255,255,0.72)",
  backdropFilter: "blur(12px)",
};

const sectionHeader = {
  marginBottom: "16px",
};

const sectionHeaderWithAction = {
  marginBottom: "16px",
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionEyebrow = {
  margin: 0,
  color: "#64748b",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.2em",
};

const sectionTitle = {
  margin: "8px 0 0",
  color: "#0f172a",
  fontSize: "26px",
  lineHeight: 1.05,
  fontWeight: 800,
};

const editButton = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const infoRow = {
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
};

const infoLabel = {
  margin: 0,
  fontSize: "13px",
  color: "#64748b",
};

const infoValue = {
  margin: "6px 0 0",
  fontWeight: 700,
  color: "#0f172a",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const inputLabel = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  color: "#475569",
  fontWeight: 600,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "18px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255,255,255,0.9)",
  outline: "none",
  boxSizing: "border-box",
};

const formActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
  flexWrap: "wrap",
};

const cancelButton = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const saveButton = {
  border: "none",
  background: "#0f766e",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const successText = {
  color: "#047857",
  fontWeight: 700,
  marginTop: 0,
  marginBottom: "14px",
};

const inlineErrorText = {
  color: "#b91c1c",
  fontWeight: 700,
  marginTop: 0,
  marginBottom: "14px",
};

const trustCard = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #fff6dc 0%, #f9e5b1 100%)",
};

const trustText = {
  margin: "10px 0 0",
  color: "#78350f",
  lineHeight: 1.5,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const statTile = {
  padding: "16px",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
};

const statTileLabel = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
};

const statTileValue = {
  margin: "8px 0 0",
  fontSize: "28px",
  fontWeight: 800,
  color: "#0f172a",
};

const financialCard = {
  marginTop: "18px",
  borderRadius: "22px",
  padding: "18px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
};

const financialRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid #e2e8f0",
};

const financialLabel = {
  color: "#475569",
  fontWeight: 500,
};

const positiveValue = {
  color: "#047857",
  fontWeight: 700,
};

const negativeValue = {
  color: "#b91c1c",
  fontWeight: 700,
};

const reviewsCard = {
  marginTop: "18px",
  borderRadius: "22px",
  padding: "18px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
};

const reviewRow = {
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
};

const reviewRowTitle = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 700,
};

const reviewRowMeta = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const reviewRowComment = {
  margin: "8px 0 0",
  color: "#334155",
  lineHeight: 1.5,
};

const reviewEmptyText = {
  margin: 0,
  color: "#64748b",
};

const stateWrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
};

const errorText = {
  color: "#b91c1c",
  fontWeight: 700,
};

const statusPill = (isVerified) => ({
  background: isVerified ? "#dcfce7" : "#fef3c7",
  color: isVerified ? "#166534" : "#92400e",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 700,
});

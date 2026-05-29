import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Heart, Sparkles, User, Edit3, Save, X, Trash2, Plus, Upload, Camera, MessageCircle, Instagram } from "lucide-react";
import "./marhala-posts.css";

const FONT_FACE_CSS = `
@font-face {
  font-family: 'Kanz al Marjaan';
  src: url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2') format('woff2'),
       url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff') format('woff'),
       url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Al-Kanz';
  src: url('/fonts/al-kanz.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;

const MARHALA_OPTIONS = [
  "Marhala Ula",
  "Marhala Saniyah",
  "Marhala Salesah",
  "Marhala Rabeah",
  "Marhala Khamesah",
  "Marhala Sadesah",
  "Marhala Sabeah",
  "Marhala Saminah",
];

const MARHALA_ARABIC_LABELS = {
  "Marhala Ula": "المرحلة الاولى",
  "Marhala Saniyah": "المرحلة الثانية",
  "Marhala Salesah": "المرحلة الثالثة",
  "Marhala Rabeah": "المرحلة الرابعة",
  "Marhala Khamesah": "المرحلة الخامسة",
  "Marhala Sadesah": "المرحلة السادسة",
  "Marhala Sabeah": "المرحلة السابعة",
  "Marhala Saminah": "المرحلة الثامنة",
};

const toArabicDigits = (str) => {
  if (str == null) return str;
  return String(str).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
};



const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const withoutOptionalPostColumns = (payload) => {
  const { age, arabic_name, ...safePayload } = payload;
  return safePayload;
};

const isMissingOptionalColumnError = (error) => {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "PGRST204" || message.includes("age") || message.includes("arabic_name") || message.includes("schema cache");
};

function MarhalaPosts({
  role = "parents",
  students = [],
  studentProfile = null,
  onShowAction,
  onPostCreated,
  maxAgeHours = null,
  limit = null,
  hideHeader = false,
  hideEmpty = false,
  homePreview = false,
  className = "",
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const postCardRef = useRef(null);

  // Form state
  const [formStudent, setFormStudent] = useState(null);
  const [formHeading, setFormHeading] = useState("");
  const [formMarhala, setFormMarhala] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formAge, setFormAge] = useState("");

  // Like animation state
  const [recentlyLiked, setRecentlyLiked] = useState({});

  // Cache for student details (photo, age)
  const [studentDetailsCache, setStudentDetailsCache] = useState({});

  const isAdmin = role === "admin";

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // Fetch student details from child_profiles
  const fetchStudentDetails = useCallback(async (studentId) => {
    if (!studentId || studentDetailsCache[studentId]) return;
    try {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("full_name, arabic_name, date_of_birth, photo_url, student_id")
        .eq("student_id", studentId)
        .maybeSingle();
      if (!error && data) {
        setStudentDetailsCache((prev) => ({
          ...prev,
          [studentId]: data,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch student details:", e);
    }
  }, [studentDetailsCache]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("marhala_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching marhala posts:", error);
        return;
      }
      const postsData = data || [];
      setPosts(postsData);
      postsData.forEach((post) => {
        if (post.student_id) fetchStudentDetails(post.student_id);
      });
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchStudentDetails]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!maxAgeHours) return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [maxAgeHours]);

  // Check if current user liked a post
  const hasLiked = (post) => {
    if (!currentUserId) return false;
    const likes = post.likes || [];
    return likes.includes(currentUserId);
  };

  // Toggle like with animation
  const handleLike = async (post) => {
    if (!currentUserId) {
      if (onShowAction) onShowAction("info", "Please login to like posts.");
      return;
    }
    const likes = post.likes || [];
    let newLikes;
    const wasLiked = likes.includes(currentUserId);
    if (wasLiked) {
      newLikes = likes.filter((id) => id !== currentUserId);
    } else {
      newLikes = [...likes, currentUserId];
    }
    // Trigger animation
    if (!wasLiked) {
      setRecentlyLiked((prev) => ({ ...prev, [post.id]: true }));
      setTimeout(() => {
        setRecentlyLiked((prev) => ({ ...prev, [post.id]: false }));
      }, 600);
    }
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, likes: newLikes } : p))
    );
    const { error } = await supabase
      .from("marhala_posts")
      .update({ likes: newLikes, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    if (error) {
      console.error("Error updating like:", error);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, likes } : p))
      );
    }
  };

  // Upload photo to Supabase storage
  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `post_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marhala_post_photos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from("marhala_post_photos")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl || "";
      if (publicUrl) {
        setFormPhotoUrl(publicUrl);
      }
    } catch (err) {
      console.error("Upload error:", err);
      if (onShowAction) onShowAction("error", "Failed to upload photo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Admin: select student from autocomplete
  const handleStudentSelect = (student) => {
    setFormStudent(student);
    setSearchTerm(student.full_name || student.name || "");
    // Auto-fill photo from student data
    const photo = student.photoUrl || student.photo_url || "";
    if (photo) setFormPhotoUrl(photo);
    // Fetch full student details for age (useMemo preview will update when cache populates)
    const studentId = student.student_id || student.id;
    if (studentId) {
      fetchStudentDetails(String(studentId));
      // Try cache synchronously
      const cached = studentDetailsCache[String(studentId)];
      if (cached?.date_of_birth) {
        const age = calculateAge(cached.date_of_birth);
        if (age !== null) setFormAge(String(age));
      }
    }
  };

  const openCreateForm = () => {
    if (showForm) {
      resetForm();
      return;
    }
    resetForm();
    setShowForm(true);
  };

  // Admin: save post (create or update)
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!formStudent) {
      if (onShowAction) onShowAction("error", "Please select a student.");
      return;
    }
    if (!formHeading.trim()) {
      if (onShowAction) onShowAction("error", "Please enter a heading.");
      return;
    }
    setSaving(true);
    try {
      const studentId = String(formStudent.student_id || formStudent.id || "");
      const studentName = formStudent.full_name || formStudent.name || "Student";
      const cachedStudent = studentDetailsCache[studentId] || {};

      const computedAge = formAge || (cachedStudent?.date_of_birth ? String(calculateAge(cachedStudent.date_of_birth)) : "");

      const postData = {
        student_name: studentName,
        arabic_name: cachedStudent.arabic_name || formStudent.arabic_name || formStudent.arabicName || "",
        marhala_name: formMarhala,
        title: formHeading,
        image_url: formPhotoUrl,
        description: computedAge,
        updated_at: new Date().toISOString(),
      };

      const isEditing = Boolean(editingPostId);

      if (isEditing) {
        // Update existing post
        const { error } = await supabase
          .from("marhala_posts")
          .update(postData)
          .eq("id", editingPostId);
        if (error) {
          if (!isMissingOptionalColumnError(error)) throw error;
          const { error: retryError } = await supabase
            .from("marhala_posts")
            .update(withoutOptionalPostColumns(postData))
            .eq("id", editingPostId);
          if (retryError) throw retryError;
        }
        if (onShowAction) onShowAction("success", "Post updated successfully!");
      } else {
        // Create new post
        const createdPost = {
          ...postData,
          student_id: studentId,
          likes: [],
        };
        const { error } = await supabase.from("marhala_posts").insert([createdPost]);
        if (error) {
          if (!isMissingOptionalColumnError(error)) throw error;
          const { error: retryError } = await supabase
            .from("marhala_posts")
            .insert([withoutOptionalPostColumns(createdPost)]);
          if (retryError) throw retryError;
        }
        if (onPostCreated) {
          try {
            await onPostCreated(createdPost);
          } catch (notifyError) {
            console.warn("Marhala post notification failed:", notifyError);
          }
        }
        if (onShowAction) onShowAction("success", "Post created successfully!");
      }
      resetForm();
      fetchPosts();
    } catch (err) {
      console.error("Error saving post:", err);
      if (onShowAction) onShowAction("error", "Failed to save post: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Admin: edit existing post
  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setFormHeading(post.title || post.heading || "");
    setFormMarhala(post.marhala_name || "");
    setFormPhotoUrl(post.image_url || "");
    setFormAge(post.description || post.age || "");
    // Try to find the student
    const found = (students || []).find(
      (s) => String(s.student_id) === String(post.student_id) || String(s.id) === String(post.student_id)
    );
    if (found) {
      setFormStudent(found);
      setSearchTerm(found.full_name || found.name || "");
      // Auto calc age from DOB if not saved
      const studentId = found.student_id || found.id;
      if (studentId) {
        const cached = studentDetailsCache[String(studentId)];
        if (cached?.date_of_birth && !post.age) {
          const age = calculateAge(cached.date_of_birth);
          if (age !== null) setFormAge(String(age));
        }
      }
    } else {
      setFormStudent({
        student_id: post.student_id,
        full_name: post.student_name,
        name: post.student_name,
      });
      setSearchTerm(post.student_name);
    }
    setShowForm(true);
  };

  // Admin: delete post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const { error } = await supabase.from("marhala_posts").delete().eq("id", postId);
    if (error) {
      console.error("Error deleting post:", error);
      if (onShowAction) onShowAction("error", "Failed to delete post.");
      return;
    }
    if (onShowAction) onShowAction("success", "Post deleted.");
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingPostId(null);
    setFormStudent(null);
    setSearchTerm("");
    setFormHeading("");
    setFormMarhala("");
    setFormPhotoUrl("");
    setFormAge("");
  };

  // Get student details from cache or students prop
  const getStudentInfo = (post) => {
    const cached = studentDetailsCache[post.student_id];
    if (cached) return cached;
    const fromProps = (students || []).find(
      (s) => String(s.student_id) === String(post.student_id) || String(s.id) === String(post.student_id)
    );
    return fromProps || null;
  };

  // Filter students for autocomplete
  const filteredStudents = (students || []).filter((s) => {
    const name = (s.full_name || s.name || "").toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Compute live preview data
  const previewPost = useMemo(() => {
    if (!formStudent) return null;
    const studentId = String(formStudent.student_id || formStudent.id || "");
    const cached = studentDetailsCache[studentId];
    const photo = formPhotoUrl || formStudent.photoUrl || formStudent.photo_url || (cached?.photo_url) || "";
    const name = formStudent.full_name || formStudent.name || "Student";
    const age = formAge || (cached?.date_of_birth ? calculateAge(cached.date_of_birth) : null);
    return {
      id: "preview",
      student_name: name,
      marhala_name: formMarhala,
      title: formHeading || "Post heading will appear here",
      image_url: photo,
      description: formAge,
      age: formAge,
      student_id: studentId,
      likes: [],
      created_at: new Date().toISOString(),
    };
  }, [formStudent, formHeading, formMarhala, formPhotoUrl, formAge, studentDetailsCache]);

  const previewStudentInfo = useMemo(() => {
    if (!formStudent) return null;
    const studentId = String(formStudent.student_id || formStudent.id || "");
    const cached = studentDetailsCache[studentId] || {};
    return {
      ...formStudent,
      ...cached,
      arabic_name: cached.arabic_name || formStudent.arabic_name || formStudent.arabicName || "",
      photo_url: formPhotoUrl || cached.photo_url || formStudent.photo_url || formStudent.photoUrl || "",
    };
  }, [formStudent, formPhotoUrl, studentDetailsCache]);

  const visiblePosts = useMemo(() => {
    let nextPosts = posts;
    if (maxAgeHours) {
      const cutoff = now - maxAgeHours * 60 * 60 * 1000;
      nextPosts = nextPosts.filter((post) => {
        const createdAt = new Date(post.created_at).getTime();
        return Number.isFinite(createdAt) && createdAt >= cutoff;
      });
    }
    return limit ? nextPosts.slice(0, limit) : nextPosts;
  }, [posts, maxAgeHours, limit, now]);

  const getShareText = (post, studentInfo) => {
    const childName = studentInfo?.arabic_name || post?.arabic_name || post?.student_name || "Marhala student";
    const marhalaName = MARHALA_ARABIC_LABELS[post?.marhala_name] || post?.marhala_name || "Marhala";
    return `${childName} - ${marhalaName}`;
  };

  const shareUrl = () => (typeof window !== "undefined" ? window.location.origin : "");

  const capturePostCard = async () => {
    const element = document.querySelector(".mp-modal-card .mp-post-card");
    if (!element) return null;
    try {
      // Preload fonts in the main document so they're cached for the clone
      const fontUrls = [
        { family: "Kanz al Marjaan", sources: [
          "url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2) format('woff2')",
          "url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff) format('woff')",
          "url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf) format('truetype')",
        ]},
        { family: "Al-Kanz", sources: ["url(/fonts/al-kanz.ttf) format('truetype')"] },
      ];
      for (const { family, sources } of fontUrls) {
        if (!document.fonts.check(`1em "${family}"`, "abcdefghijklmnopqrstuvwxyz0123456789")) {
          const ff = new FontFace(family, sources.join(", "));
          await ff.load();
          document.fonts.add(ff);
        }
      }
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);

      const mod = await import("html2canvas");
      const h2c = mod.default || mod;
      const canvas = await h2c(element, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: async (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = FONT_FACE_CSS;
          clonedDoc.head.appendChild(style);
          if (clonedDoc.fonts && clonedDoc.fonts.ready) {
            await Promise.race([
              clonedDoc.fonts.ready,
              new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
          }
        },
      });
      return canvas;
    } catch {
      return null;
    }
  };

  const canvasToFile = (canvas, filename) => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], filename, { type: "image/png" }));
      }, "image/png");
    });
  };

  const handleShareImage = async (post, studentInfo, source) => {
    const canvas = await capturePostCard();
    if (!canvas) {
      const text = `${getShareText(post, studentInfo)} ${shareUrl()}`.trim();
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      return;
    }
    const file = await canvasToFile(canvas, `marhala-post-${post.id}.png`);
    if (!file) return;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Marhala Post" });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const link = document.createElement("a");
    link.download = `marhala-post-${post.id}.png`;
    link.href = URL.createObjectURL(file);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleWhatsAppShare = (post, studentInfo) => handleShareImage(post, studentInfo, "whatsapp");
  const handleInstagramShare = (post, studentInfo) => handleShareImage(post, studentInfo, "instagram");

  if (!loading && hideEmpty && visiblePosts.length === 0) {
    return null;
  }

  return (
    <div className={`marhala-posts-container fade-in ${className}`.trim()}>
      {/* Header */}
      {!hideHeader && <div className="mp-header">
        <div className="mp-header-content">
          <div className="mp-header-icon-wrap">
            <Sparkles size={22} className="mp-header-icon" />
          </div>
          <div>
            <h2 className="mp-title">Marhala Posts</h2>
            <p className="mp-subtitle">
              {isAdmin
                ? "Create and manage Ikhtebar achievement posts"
                : "Celebrating Ikhtebar achievements"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button type="button" className="mp-create-btn" onClick={openCreateForm}>
            <Plus size={18} /> {showForm ? "Close" : "New Post"}
          </button>
        )}
      </div>}

      {/* Admin Form */}
      {isAdmin && showForm && (
        <div className="mp-form-section">
          <div className="mp-form-card card-appear">
            <div className="mp-form-header">
              <h3>{editingPostId ? "✏️ Edit Post" : "✨ Create New Post"}</h3>
              <button className="mp-close-form-btn" onClick={resetForm} title="Close">
                <X size={20} />
              </button>
            </div>
            <form className="mp-form" onSubmit={handleSavePost}>
              {/* Student Search */}
              <div className="mp-form-group">
                <label>👤 Student</label>
                <div className="mp-autocomplete">
                  <input
                    type="text"
                    placeholder="Search student name..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setFormStudent(null); }}
                    className="mp-input"
                    required
                  />
                  {searchTerm && !formStudent && filteredStudents.length > 0 && (
                    <div className="mp-autocomplete-dropdown">
                      {filteredStudents.slice(0, 8).map((s) => (
                        <button
                          key={s.student_id || s.id}
                          type="button"
                          className="mp-autocomplete-item"
                          onClick={() => handleStudentSelect(s)}
                        >
                          <User size={14} />
                          {s.full_name || s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Student Preview */}
              {formStudent && (
                <div className="mp-student-preview">
                  <div className="mp-student-preview-avatar">
                    {(formPhotoUrl || formStudent.photoUrl || formStudent.photo_url) ? (
                      <img src={formPhotoUrl || formStudent.photoUrl || formStudent.photo_url} alt="" />
                    ) : (
                      <User size={28} />
                    )}
                  </div>
                  <div className="mp-student-preview-info">
                    <span className="mp-student-preview-name">
                      {previewStudentInfo?.arabic_name ? (
                        <span className="mp-arabic-text" dir="rtl">{previewStudentInfo.arabic_name}</span>
                      ) : (
                        formStudent.full_name || formStudent.name
                      )}
                    </span>
                    <div className="mp-student-preview-meta">
                      <span className="mp-student-preview-age-label">
                        🎂 Age: {formAge ? <><span className="mp-age-digits">{toArabicDigits(formAge)}</span> yrs</> : "auto"}
                      </span>
                      <span className="mp-student-preview-id">
                        ID: {formStudent.student_id || formStudent.id}
                      </span>
                    </div>
                  </div>
                  <button type="button" className="mp-student-preview-change" onClick={() => { setFormStudent(null); setSearchTerm(""); }}>
                    Change
                  </button>
                </div>
              )}

              {/* Age Control */}
              <div className="mp-form-row mp-form-row-inline">
                <div className="mp-form-group" style={{ flex: 1 }}>
                  <label>🎂 Age (years)</label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    placeholder="Auto-calculated or edit"
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    className="mp-input mp-age-input"
                  />
                </div>
                <div className="mp-form-group" style={{ flex: 2 }}>
                  <label>🏅 Marhala</label>
                  <select
                    value={formMarhala}
                    onChange={(e) => setFormMarhala(e.target.value)}
                    className="mp-input mp-select mp-marhala-select"
                  >
                    <option value="">Select Marhala...</option>
                    {MARHALA_OPTIONS.map((m) => (
                      <option key={m} value={m}>{MARHALA_ARABIC_LABELS[m] || m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Heading */}
              <div className="mp-form-group">
                <label>📝 Heading</label>
                <input
                  type="text"
                  placeholder="e.g. Mabrook! Passed Marhala Ula with excellence!"
                  value={formHeading}
                  onChange={(e) => setFormHeading(e.target.value)}
                  className="mp-input"
                  required
                />
              </div>

              {/* Photo Upload */}
              <div className="mp-form-group">
                <label>📸 Child Photo</label>
                <div className="mp-photo-upload-wrapper">
                  <div className="mp-photo-upload-area">
                    {formPhotoUrl ? (
                      <div className="mp-photo-preview">
                        <img src={formPhotoUrl} alt="Child photo" />
                        <button
                          type="button"
                          className="mp-photo-remove"
                          onClick={() => setFormPhotoUrl("")}
                          title="Remove photo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="mp-photo-placeholder">
                        <Camera size={28} />
                        <span>Upload</span>
                      </div>
                    )}
                    <label className="mp-photo-upload-btn">
                      <Upload size={16} />
                      {uploading ? "Uploading..." : "Choose File"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={uploading}
                        onChange={(e) => {
                          if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <div className="mp-photo-or-url">
                      <span>or URL:</span>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formPhotoUrl}
                        onChange={(e) => setFormPhotoUrl(e.target.value)}
                        className="mp-input mp-url-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mp-form-actions">
                <button type="button" className="mp-btn mp-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="mp-btn mp-btn-primary" disabled={saving || uploading}>
                  <Save size={16} /> {saving ? "Saving..." : editingPostId ? "Update Post" : "Create Post"}
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Card */}
          {previewPost && (
            <div className="mp-preview-section">
              <div className="mp-preview-label">👁️ Live Preview</div>
              <PostCard
                post={previewPost}
                studentInfo={previewStudentInfo}
                isPreview
              />
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="mp-feed">
        {loading ? (
          <div className="mp-loading">
            <div className="spinner" />
            <p>Loading posts...</p>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-icon">
              <Sparkles size={48} />
            </div>
            <h3>No Marhala Posts Yet</h3>
            <p>
              {isAdmin
                ? "Create the first achievement post to celebrate students' Ikhtebar success!"
                : "Achievement posts will appear here when students pass their Ikhtebar exams."}
            </p>
          </div>
        ) : (
          visiblePosts.map((post) => {
            const studentInfo = getStudentInfo(post);
            if (homePreview) {
              return (
                <CompactMarhalaPostCard
                  key={post.id}
                  post={post}
                  studentInfo={studentInfo}
                  hasLiked={hasLiked(post)}
                  recentlyLiked={recentlyLiked[post.id]}
                  onLike={handleLike}
                  onOpen={() => setSelectedPost(post)}
                />
              );
            }
            return (
              <PostCard
                key={post.id}
                post={post}
                studentInfo={studentInfo}
                currentUserId={currentUserId}
                hasLiked={hasLiked(post)}
                recentlyLiked={recentlyLiked[post.id]}
                onLike={handleLike}
                isAdmin={isAdmin}
                onEdit={handleEditPost}
                onDelete={handleDeletePost}
              />
            );
          })
        )}
      </div>

      {homePreview && selectedPost && (() => {
        const currentPost = posts.find((post) => post.id === selectedPost.id) || selectedPost;
        const studentInfo = getStudentInfo(currentPost);
        return (
          <div className="mp-modal-backdrop" onClick={() => setSelectedPost(null)}>
            <div className="mp-modal-card" ref={postCardRef} onClick={(event) => event.stopPropagation()}>
              <button className="mp-modal-close" onClick={() => setSelectedPost(null)} aria-label="Close Marhala post">
                <X size={20} />
              </button>
              <PostCard
                post={currentPost}
                studentInfo={studentInfo}
                currentUserId={currentUserId}
                hasLiked={hasLiked(currentPost)}
                recentlyLiked={recentlyLiked[currentPost.id]}
                onLike={handleLike}
              />
              <div className="mp-share-actions">
                <button className="mp-share-btn whatsapp" onClick={() => handleWhatsAppShare(currentPost, studentInfo)}>
                  <MessageCircle size={18} /> WhatsApp Status
                </button>
                <button className="mp-share-btn instagram" onClick={() => handleInstagramShare(currentPost, studentInfo)}>
                  <Instagram size={18} /> Instagram Story
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ====== Post Card Component - Certificate Style ======
const CornerOrnament = ({ className }) => (
  <div className={className} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Decorative corner flourish */}
      <path d="M2 38V28C2 13.64 13.64 2 28 2H38" stroke="#c5a059" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M6 34V26C6 14.954 14.954 6 26 6H34" stroke="#8a6515" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.5"/>
      <circle cx="8" cy="32" r="1.5" fill="#c5a059" opacity="0.6"/>
      <circle cx="12" cy="28" r="1" fill="#c5a059" opacity="0.4"/>
      <circle cx="32" cy="8" r="1.5" fill="#c5a059" opacity="0.6"/>
      <circle cx="28" cy="12" r="1" fill="#c5a059" opacity="0.4"/>
    </svg>
  </div>
);

function CompactMarhalaPostCard({ post, studentInfo, hasLiked, recentlyLiked, onLike, onOpen }) {
  const likeCount = (post.likes || []).length;
  const postPhoto = post.image_url || studentInfo?.photo_url || studentInfo?.photoUrl || "";
  const childName = studentInfo?.arabic_name || studentInfo?.arabicName || post.arabic_name || post.student_name || "Marhala Post";
  const marhalaDisplay = MARHALA_ARABIC_LABELS[post.marhala_name] || post.marhala_name || "Marhala";

  return (
    <article className="mp-compact-card card-appear">
      <button className="mp-compact-photo" onClick={onOpen} aria-label="Open Marhala post">
        {postPhoto ? <img src={postPhoto} alt={post.student_name || "Marhala post"} /> : <User size={28} />}
      </button>
      <div className="mp-compact-info">
        <span className="mp-compact-eyebrow mp-arabic-text" dir="rtl">{marhalaDisplay}</span>
        <h3 className="mp-compact-name mp-arabic-text" dir={studentInfo?.arabic_name || studentInfo?.arabicName || post.arabic_name ? "rtl" : "auto"}>{childName}</h3>
      </div>
      <div className="mp-compact-actions">
        <button
          className={`mp-compact-like ${recentlyLiked ? "just-liked" : ""}`}
          onClick={(event) => { event.stopPropagation(); onLike && onLike(post); }}
          aria-label={hasLiked ? "Unlike" : "Like"}
        >
          <Heart size={18} fill={hasLiked ? "var(--like-red)" : "none"} color={hasLiked ? "var(--like-red)" : "var(--deep-brown)"} />
          <span className="mp-like-count">{toArabicDigits(likeCount)}</span>
        </button>
        <button className="mp-compact-open" onClick={onOpen}>Open</button>
      </div>
    </article>
  );
}

function PostCard({
  post,
  studentInfo = null,
  currentUserId,
  hasLiked,
  recentlyLiked,
  onLike,
  isAdmin,
  onEdit,
  onDelete,
  isPreview = false,
}) {
  const likeCount = (post.likes || []).length;
  const postPhoto = post.image_url || studentInfo?.photo_url || studentInfo?.photoUrl || "";
  const studentAge = post.description || post.age || (studentInfo?.date_of_birth ? calculateAge(studentInfo.date_of_birth) : null);
  const postHeading = post.title || post.heading || "";
  const marhalaDisplay = post.marhala_name || "";
  const marhalaArabicDisplay = MARHALA_ARABIC_LABELS[marhalaDisplay] || marhalaDisplay;
  const studentArabicName = studentInfo?.arabic_name || studentInfo?.arabicName || post.arabic_name || "";
  const displayStudentName = studentArabicName;

  return (
    <div className={`mp-post-card card-appear ${isPreview ? 'mp-preview-card' : ''}`}>
      {/* Subtle geometric pattern background */}
      <div className="mp-certificate-bg-pattern" />
      
      {/* Ornate corner decorations */}
      <CornerOrnament className="mp-cert-corner mp-cert-corner-tl" />
      <CornerOrnament className="mp-cert-corner mp-cert-corner-tr" />
      <CornerOrnament className="mp-cert-corner mp-cert-corner-bl" />
      <CornerOrnament className="mp-cert-corner mp-cert-corner-br" />

      {/* Ornament frame overlay */}
      <div className="mp-cert-ornament-frame" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="98" height="98" rx="2" stroke="#c5a059" strokeWidth="0.5" strokeDasharray="4 6" fill="none" opacity="0.3"/>
          <rect x="3" y="3" width="94" height="94" rx="1" stroke="#8a6515" strokeWidth="0.3" fill="none" opacity="0.15"/>
        </svg>
      </div>

      {/* Inner certificate container */}
      <div className="mp-certificate-inner">
        {/* Action buttons - overlaid top-right */}
        <div className="mp-post-actions">
          <div className="mp-like-group">
            <button
              className={`mp-like-btn ${recentlyLiked ? "just-liked" : ""}`}
              onClick={() => onLike && onLike(post)}
              aria-label={hasLiked ? "Unlike" : "Like"}
            >
              <Heart
                size={18}
                fill={hasLiked ? "var(--like-red)" : "none"}
                color={hasLiked ? "var(--like-red)" : "var(--deep-brown)"}
                className={`mp-heart-icon ${recentlyLiked ? "heart-pop" : ""}`}
              />
            </button>
            <span className={`mp-like-count ${likeCount > 0 ? "has-likes" : ""}`}>
              {toArabicDigits(likeCount)}
            </span>
          </div>

          {isAdmin && !isPreview && (
            <div className="mp-post-admin-actions">
              <button className="mp-icon-btn" onClick={() => onEdit && onEdit(post)} title="Edit post">
                <Edit3 size={14} />
              </button>
              <button className="mp-icon-btn mp-icon-btn-danger" onClick={() => onDelete && onDelete(post.id)} title="Delete post">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Certificate Header - School Name */}
        <div className="mp-cert-header">
          <h3 className="mp-cert-school-name mp-arabic-text" dir="rtl">تحفيظ - روضة تحفيظ الأطفال</h3>
          <p className="mp-cert-school-name-sub">Tahfeez • Rawdat Tahfeez al Atfal</p>
          
          <div className="mp-cert-star-divider">
            <div className="mp-cert-deco-line" />
            <Sparkles size={14} className="mp-cert-star-icon" />
            <div className="mp-cert-deco-line" />
          </div>
        </div>

        {/* Certificate Body */}
        <div className="mp-cert-body">
          {/* Left: Text Info */}
          <div className="mp-cert-info">
            {displayStudentName && (
              <h2 className="mp-cert-student-name mp-arabic-text" dir="rtl">{displayStudentName}</h2>
            )}
          </div>

          {/* Right: Student Photo */}
          <div className="mp-cert-photo-area">
            {postPhoto ? (
              <img
                src={postPhoto}
                alt={post.student_name}
                className="mp-cert-photo"
                onError={(e) => {
                  e.target.style.display = "none";
                  // Show the placeholder fallback after image fails
                  const placeholder = e.target.parentElement?.querySelector('.mp-cert-photo-placeholder');
                  if (placeholder) placeholder.style.display = "flex";
                }}
              />
            ) : null}
            {!postPhoto && (
              <div className="mp-cert-photo-placeholder">
                <User size={32} />
                <span>Photo</span>
              </div>
            )}
            {studentAge !== null && (
              <div className="mp-cert-photo-age">
                <span className="mp-cert-detail-label">Age</span>
                <span className="mp-cert-detail-value"><span className="mp-age-digits">{toArabicDigits(studentAge)}</span> years</span>
              </div>
            )}
            <div className="mp-cert-blessing mp-arabic-text" dir="rtl">مبارك مهنّا</div>
          </div>
        </div>

        {/* Center Section: Marhala badge + Heading above decorative line */}
        <div className="mp-cert-center-info">
          {marhalaDisplay && (
            <div className="mp-cert-marhala-badge mp-arabic-text" dir="rtl">
              <Sparkles size={16} />
              {marhalaArabicDisplay}
            </div>
          )}
          {postHeading && (
            <p className="mp-cert-heading" dir="auto">{postHeading}</p>
          )}
        </div>

        {/* Decorative line */}
        <div className="mp-cert-deco-line-thick" />

        {/* Certificate Footer - Location */}
        <div className="mp-cert-footer">
          <p className="mp-cert-footer-location">Pakhti Mubarak • Galiakot</p>
        </div>
      </div>
    </div>
  );
}

export default MarhalaPosts;

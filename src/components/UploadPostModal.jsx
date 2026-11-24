import React, { useState } from 'react';
import { ImagePlus, X, UploadCloud, AlertCircle, Film } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';
import { platformMeta } from '../data/mockData';
import { uploadPosterImages } from '../utils/posterImages';

const UPLOAD_PLATFORMS = ['ig', 'fb', 'yt'];

// YouTube posts need a real video file to actually upload (see
// src/utils/youtube.js / server.js's POST /api/youtube/publish) — an image
// alone isn't something the YouTube Data API can do anything with, so this
// platform swaps the image picker for a video picker instead.
const VIDEO_PLATFORMS = ['yt'];

// Manual upload path for posts that didn't come out of the AI Generate flow
// — pick a platform, drop in your own image(s)/video and caption, and it
// lands in the Post list as a normal draft. From there it goes through the
// exact same Publish / Schedule / Save flow as any generated post — this
// modal only creates the item, it doesn't touch how publishing works.
export default function UploadPostModal({ onClose, onUpload }) {
  const [platform, setPlatform] = useState('ig');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]); // [{ id, img: dataUrl }]
  const [videoFile, setVideoFile] = useState(null); // a real File object — never converted to base64
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const isVideo = VIDEO_PLATFORMS.includes(platform);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((imgs) => [...imgs, { id: `${Date.now()}-${Math.random()}`, img: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Kept as a real File object in memory rather than a base64 data: URL —
  // video files are far too large to round-trip through localStorage the
  // way generated poster images do (see AdminPanel.jsx's content-persist
  // effect, which deliberately strips this back out before saving).
  const handleVideoFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
    e.target.value = '';
  };

  const removeImage = (id) => setImages((imgs) => imgs.filter((i) => i.id !== id));

  const submit = async () => {
    setError('');
    if (!title.trim()) return setError('Give this post a title.');
    if (isVideo) {
      if (!videoFile) return setError('Attach a video file.');
      onUpload({
        id: `upload-${Date.now()}`,
        kind: platform,
        title: title.trim(),
        status: 'draft',
        createdAt: new Date().toISOString().slice(0, 10),
        post: { videoFile, videoName: videoFile.name, caption: caption.trim() },
      });
      onClose();
      return;
    }
    if (images.length === 0) return setError('Upload at least one image.');
    // Uploaded images are read as local base64 data: URLs above for the
    // instant preview -- swap those for hosted /api/poster-image URLs here,
    // right before the post actually gets created, so they don't end up
    // embedded raw in the shared 'content' save (see posterImages.js).
    setUploading(true);
    const hostedUrls = await uploadPosterImages(images.map((img) => img.img));
    setUploading(false);
    onUpload({
      id: `upload-${Date.now()}`,
      kind: platform,
      title: title.trim(),
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
      post: { images: hostedUrls.map((img, i) => ({ id: i + 1, img })), caption: caption.trim() },
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={480}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Upload a post</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 20 }}>
        Bring your own image(s) and caption instead of generating one — it'll land as a draft you can publish,
        schedule, or save like any other post.
      </p>

      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
        Platform
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {UPLOAD_PLATFORMS.map((id) => (
          <button
            key={id}
            onClick={() => setPlatform(id)}
            style={{
              flex: 1,
              padding: '9px 10px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: platform === id ? '1.5px solid var(--accent-violet)' : '1px solid rgba(183,169,154,0.35)',
              background: platform === id ? 'rgba(242,170,36,0.1)' : 'rgba(255,255,255,0.5)',
              color: 'var(--ink-900)',
            }}
          >
            {platformMeta[id]?.label || id}
          </button>
        ))}
      </div>

      <input
        placeholder="Post title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ ...inputStyle, marginBottom: 10 }}
      />

      <textarea
        placeholder="Caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
        style={{ ...inputStyle, marginBottom: 14, resize: 'vertical', fontFamily: 'var(--font-body)' }}
      />

      {isVideo ? (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
            Video file
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1.5px dashed rgba(183,169,154,0.5)',
              cursor: 'pointer',
              color: videoFile ? 'var(--ink-900)' : 'var(--ink-500)',
              marginBottom: 10,
            }}
          >
            <Film size={18} color="var(--accent-violet)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5 }}>
              {videoFile ? videoFile.name : 'Click to choose a video file (.mp4, .mov, …)'}
            </span>
            <input type="file" accept="video/*" onChange={handleVideoFile} style={{ display: 'none' }} />
          </label>
        </>
      ) : (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
            Image(s)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {images.map((img) => (
              <div key={img.id} style={{ position: 'relative', width: 72, height: 72 }}>
                <img src={img.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                <button
                  onClick={() => removeImage(img.id)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--accent-coral)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                border: '1.5px dashed rgba(183,169,154,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--ink-500)',
                gap: 2,
              }}
            >
              <ImagePlus size={16} />
              <span style={{ fontSize: 9.5 }}>Add</span>
              <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
            </label>
          </div>
        </>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 12, borderRadius: 10, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 12 }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <GlassButton variant="primary" icon={UploadCloud} disabled={uploading} style={{ justifyContent: 'center', width: '100%', marginTop: 4 }} onClick={submit}>
        {uploading ? 'Uploading…' : 'Add as draft'}
      </GlassButton>
    </Modal>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(183,169,154,0.35)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: 13.8,
  outline: 'none',
};

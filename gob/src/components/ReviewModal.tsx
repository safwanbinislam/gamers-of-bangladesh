"use client";

import { useState } from "react";

interface ReviewModalProps {
  tradeId: string;
  revieweeId: string;
  revieweeUsername: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewModal({ tradeId, revieweeId, revieweeUsername, isOpen, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); onClose(); }, 2000);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-dark-surface-2 border border-dark-border rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-semibold text-lg text-text-primary">Review Submitted!</h3>
          <p className="text-sm text-text-muted mt-1">Thanks for your feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-dark-surface-2 border border-dark-border rounded-2xl p-6 max-w-sm w-full space-y-4">
        <h3 className="font-semibold text-lg text-text-primary">Rate {revieweeUsername}</h3>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => setRating(star)} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
              className={`text-3xl transition-colors ${star <= (hoveredStar || rating) ? "text-amber-400" : "text-gray-600"}`}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}>★</button>
          ))}
        </div>
        <textarea placeholder="Optional: share your experience..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary" />
        <p className="text-xs text-text-muted text-right">{comment.length}/1000</p>
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={rating === 0 || isSubmitting}
            className="flex-1 bg-primary text-white rounded-lg py-2 font-medium hover:bg-primary-hover disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Skip</button>
        </div>
      </div>
    </div>
  );
}
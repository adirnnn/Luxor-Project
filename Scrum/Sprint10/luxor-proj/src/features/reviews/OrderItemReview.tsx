import { useState, type FC, type FormEvent } from "react";
import { COMMENT_MAX_LENGTH, createReview, type MyReview } from "../../services/reviewService";
import { friendlyError } from "../../services/apiClient";
import { StarInput, Stars } from "./StarRating";

// SFTWRKEY-431: en Mi cuenta, cada perfume de un pedido entregado se puede calificar una vez.
// El backend vuelve a revisar que el pedido sea del cliente y esté entregado.
type Props = {
  orderId: number;
  productId: string;
  productName: string;
  review?: MyReview;
  onCreated: (review: MyReview) => void;
};

export const OrderItemReview: FC<Props> = ({ orderId, productId, productName, review, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (review) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-primary-champagne/60">
        <span>Tu calificación:</span>
        <Stars value={review.rating} size="sm" />
        {review.hidden && <span className="italic text-primary-champagne/40">(la tienda la ocultó)</span>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Calificar ${productName}`}
        className="self-start border border-primary-gold text-primary-gold rounded-lg px-4 py-1.5 text-[10px] uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors"
      >
        Calificar
      </button>
    );
  }

  const length = Array.from(comment.trim()).length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Elige una calificación de 1 a 5 estrellas.");
      return;
    }
    if (length > COMMENT_MAX_LENGTH) {
      setError(`El comentario puede tener hasta ${COMMENT_MAX_LENGTH} caracteres.`);
      return;
    }
    setSaving(true);
    try {
      const { review: created } = await createReview({ orderId, productId, rating, comment: comment.trim() });
      onCreated(created);
    } catch (err) {
      setError(friendlyError(err, "No se pudo publicar la reseña."));
    } finally {
      setSaving(false);
    }
  };

  const commentId = `resena-${orderId}-${productId}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
      <StarInput value={rating} onChange={setRating} disabled={saving} />

      <div className="flex flex-col gap-1">
        <label htmlFor={commentId} className="text-xs text-primary-champagne/60 uppercase tracking-widest">
          Comentario (opcional)
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          disabled={saving}
          placeholder="¿Qué te pareció el aroma, la duración, la proyección?"
          className="bg-white/10 rounded-lg px-3 py-2 text-sm text-primary-champagne placeholder:text-primary-champagne/30 focus:outline-none focus:ring-2 focus:ring-primary-gold resize-y"
        />
        <span className="self-end text-[10px] text-primary-champagne/40">{length}/{COMMENT_MAX_LENGTH}</span>
      </div>

      {error && <p role="alert" className="text-xs text-status-error">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-primary-gold text-primary-black font-bold rounded-lg py-2 text-xs uppercase tracking-widest disabled:opacity-50"
        >
          {saving ? "Publicando..." : "Publicar reseña"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setRating(0);
            setComment("");
            setError(null);
          }}
          className="flex-1 bg-white/10 text-primary-champagne rounded-lg py-2 text-xs uppercase tracking-widest disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

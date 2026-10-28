
import { API_URL } from "./apiClient";

// tiene que ser igual a COMMENT_MAX_LENGTH de backend/routes/reviews.js
export const COMMENT_MAX_LENGTH = 500;

export type PublicReview = {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    author: string;
};

export type ProductReviews = {
    average: number | null;
    count: number;
    reviews: PublicReview[];
};

export type MyReview = {
    id: number;
    order_id: number;
    product_id: string;
    rating: number;
    comment: string | null;
    hidden: boolean;
    created_at: string;
};

export type AdminReview = MyReview & {
    product_name: string;
    user_name: string | null;
    user_email: string | null;
};

export type ReviewFilters = {
    status?: "" | "visible" | "hidden";
    page?: number;
    limit?: number;
};

export type RatingSummary = { average: number | null; count: number };

async function getJson(path: string, errorMessage: string, init?: RequestInit) {
    // SFTWRKEY-451: la sesión va en la cookie, el navegador la manda sola
    const res = await fetch(`${API_URL}${path}`, init);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.message || errorMessage);
    }
    return body;
}

export async function fetchProductReviews(productId: string): Promise<ProductReviews> {
    const data = await getJson(`/products/${encodeURIComponent(productId)}/reviews`, "Error al obtener las reseñas");
    return {
        average: data?.average ?? null,
        count: data?.count ?? 0,
        reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    };
}

export async function fetchMyReviews(userId: number | string): Promise<MyReview[]> {
    const data = await getJson(`/user/${userId}/reviews`, "Error al obtener tus reseñas");
    return Array.isArray(data?.reviews) ? data.reviews : [];
}

export async function createReview(input: {
    orderId: number;
    productId: string;
    rating: number;
    comment: string;
}): Promise<{ review: MyReview; rating: RatingSummary }> {
    const data = await getJson("/reviews", "No se pudo publicar la reseña", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return { review: data.review, rating: data.rating };
}

export async function fetchAdminReviews(filters: ReviewFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const data = await getJson(`/admin/reviews?${params}`, "Error al obtener las reseñas");
    return data as { reviews: AdminReview[]; total: number; page: number; limit: number };
}

export async function setReviewHidden(id: number, hidden: boolean): Promise<{ review: MyReview; rating: RatingSummary }> {
    const data = await getJson(`/admin/reviews/${id}`, "No se pudo actualizar la reseña", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
    });
    return { review: data.review, rating: data.rating };
}

import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import fetch_all_data
from recommender_content_based import ContentBasedRecommender
from recommender_collaborative import CollaborativeRecommender
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tunerate")

content_recommender = ContentBasedRecommender()
collab_recommender = CollaborativeRecommender()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Uruchamiam aplikację FastAPI – lifespan start")
    try:
        df_reviews, df_albums, df_tags, df_user_albums, df_artists = fetch_all_data()
        logger.info("🔄 Trenowanie systemów rekomendacji...")

        # Content-based
        content_recommender.train(df_reviews, df_albums, df_tags, df_user_albums, df_artists)

        # Collaborative
        collab_recommender.train(df_reviews, df_albums)

        logger.info("✅ Systemy rekomendacji gotowe.")
    except Exception as e:
        logger.exception("❌ Błąd podczas trenowania modeli")
    yield
    logger.info("🛑 Zamykam aplikację FastAPI – lifespan end")

app = FastAPI(title="TuneRate Recommendation Service", lifespan=lifespan)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "content_trained": content_recommender.trained,
        "collab_trained": collab_recommender.trained
    }

@app.get("/recommend/content/{user_id}")
def recommend_content(user_id: str, top_n: int = 5):
    df_reviews, df_albums, df_tags, df_user_albums, df_artists = fetch_all_data()
    recs = content_recommender.recommend(user_id, df_reviews, df_albums, df_tags, df_user_albums, top_n)
    return {"type": "content-based", "user_id": user_id, "recommendations": recs}

@app.get("/recommend/cf/{user_id}")
def recommend_collaborative(user_id: str, top_n: int = 5):
    df_reviews, df_albums, _, _, df_artists = fetch_all_data()
    recs = collab_recommender.recommend(user_id, df_albums, df_artists, top_n, df_reviews=df_reviews)
    return {"type": "collaborative", "user_id": user_id, "recommendations": recs}

@app.get("/recommend/album/{album_id}")
def recommend_for_album(album_id: str, top_n: int = 5):
    df_reviews, df_albums, df_tags, _, df_artists = fetch_all_data()
    recs = content_recommender.recommend_similar(album_id, df_albums, df_tags, df_artists, top_n)
    return {"type": "similar-albums", "album_id": album_id, "recommendations": recs}


@app.get("/recommend/hybrid/{user_id}")
def recommend_hybrid(user_id: str, top_n: int = 5, alpha: float = 0.5):
    """
    Hybrid recommendations:  alpha in [0,1] weights collaborative (alpha) vs content-based (1-alpha).
    Returns top_n combined recommendations for a user.
    """
    # walidacja alpha
    try:
        alpha = float(alpha)
    except Exception:
        alpha = 0.5
    alpha = max(0.0, min(1.0, alpha))

    # Pobierz dane
    df_reviews, df_albums, df_tags, df_user_albums, df_artists = fetch_all_data()

    # opcjonalne automatyczne skalowanie alpha w zależności od liczby recenzji użytkownika
    try:
        user_reviews_count = int(df_reviews[df_reviews.get("UserId").astype(str) == str(user_id)].shape[0])
    except Exception:
        user_reviews_count = 0
    # próg, przy którym CF ma pełne zaufanie (np. 5 recenzji)
    cf_confidence_threshold = 5.0
    cf_confidence = min(1.0, user_reviews_count / cf_confidence_threshold)
    # shrinkujemy alpha proporcjonalnie do pewności CF
    effective_alpha = alpha * cf_confidence
    logger.info(f"hybrid: user_reviews={user_reviews_count}, alpha={alpha} -> effective_alpha={effective_alpha:.3f}")

    # Pobierz kandydatów z obu modeli (zwiększamy pulę, aby łączyć ranking)
    pool_size = max(top_n * 3, 10)
    content_recs = []
    collab_recs = []

    if content_recommender.trained:
        content_recs = content_recommender.recommend(user_id, df_reviews, df_albums, df_tags, df_user_albums, top_n=pool_size)
    else:
        logger.info("⚠️ Content-based nie wytrenowany dla hybrydowego.")

    if collab_recommender.trained:
        collab_recs = collab_recommender.recommend(user_id, df_albums, df_artists, top_n=pool_size, df_reviews=df_reviews)
    else:
        logger.info("⚠️ Collaborative nie wytrenowany dla hybrydowego.")

    if not content_recs and not collab_recs:
        return {"type": "hybrid", "user_id": user_id, "recommendations": [], "note": "Brak wytrenowanych modeli lub danych dla użytkownika."}

    # --- Budujemy mapy surowych score'ów (oparte o rank) dla obu źródeł ---
    def build_rank_map(recs):
        rank_map = {}
        n = len(recs)
        if n == 0:
            return rank_map
        # preferuj użycie istniejących pól podobieństwa/punktacji jeśli są
        raw_scores = []
        for idx, r in enumerate(recs):
            aid = str(r.get("id") or r.get("Id") or r.get("albumId") or "")
            if not aid:
                continue
            # jeśli model zwrócił już 'similarity' lub 'score', użyjemy tego jako surowego score
            if "similarity" in r:
                raw = float(r.get("similarity") or 0.0)
            elif "score" in r:
                raw = float(r.get("score") or 0.0)
            else:
                # fallback: liniowy rank-based score (większy = lepszy)
                raw = (n - 1 - idx) / max(1, (n - 1))  # w [0,1], top=1, bottom=0
            rank_map[aid] = raw
            raw_scores.append(raw)
        return rank_map

    content_map = build_rank_map(content_recs)
    collab_map = build_rank_map(collab_recs)

    # --- Normalizacja min-max każdego źródła do [0,1] ---
    def normalize_map(m):
        if not m:
            return {}
        vals = list(m.values())
        vmin, vmax = min(vals), max(vals)
        if vmax == vmin:
            # wszystko takie samo -> dajemy 1.0 dla niepustych
            return {k: 1.0 for k in m.keys()}
        return {k: (v - vmin) / (vmax - vmin) for k, v in m.items()}

    content_norm = normalize_map(content_map)
    collab_norm = normalize_map(collab_map)

    # --- Agregacja ważona z użyciem effective_alpha ---
    scores = {}
    details = {}
    # content priority przy wypełnianiu details
    for r in content_recs:
        aid = str(r.get("id") or r.get("Id") or r.get("albumId") or "")
        if not aid:
            continue
        details.setdefault(aid, r)
    for r in collab_recs:
        aid = str(r.get("id") or r.get("Id") or r.get("albumId") or "")
        if not aid:
            continue
        details.setdefault(aid, r)

    content_weight = 1.0 - effective_alpha
    collab_weight = effective_alpha

    for aid, val in content_norm.items():
        scores[aid] = scores.get(aid, 0.0) + content_weight * float(val)
    for aid, val in collab_norm.items():
        scores[aid] = scores.get(aid, 0.0) + collab_weight * float(val)

    # Posortuj wg skumulowanego score i wybierz top_n
    sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_ids = [k for k, _ in sorted_ids[:top_n]]

    # Zbuduj listę wyników z dostępnych pól (wypełnij z df_albums jeśli potrzeba)
    final_recs = []
    df_albums_local = df_albums.copy()
    if "Id" in df_albums_local.columns:
        df_albums_local["Id"] = df_albums_local["Id"].astype(str)

    for aid in top_ids:
        rec = details.get(aid, {}).copy()
        # jeśli brak podstawowych pól, pobierz z df_albums + artist
        if not rec.get("id") and not rec.get("title"):
            row = df_albums_local[df_albums_local["Id"] == aid]
            if not row.empty:
                row = row.iloc[0].to_dict()
                # dopasowanie nazw kolumn do formatu API
                rec.setdefault("id", row.get("Id"))
                rec.setdefault("title", row.get("Title"))
                rec.setdefault("artistId", row.get("ArtistId"))
                rec.setdefault("releaseDate", row.get("ReleaseDate"))
                rec.setdefault("externalId", row.get("ExternalId"))
                rec.setdefault("coverUrl", row.get("CoverUrl"))
        # spróbuj dołączyć nazwę artysty, jeśli jest dostępna w df_artists
        if rec.get("artist") in (None, "") and df_artists is not None and not df_artists.empty:
            try:
                artist_row = df_artists[df_artists["Id"].astype(str) == str(rec.get("artistId"))]
                if not artist_row.empty:
                    rec["artist"] = artist_row.iloc[0].get("Name")
            except Exception:
                pass
        # dodaj ostateczny score
        rec["hybridScore"] = round(float(scores.get(aid, 0.0)), 4)
        final_recs.append(rec)

    return {"type": "hybrid", "user_id": user_id, "alpha": alpha, "effective_alpha": round(effective_alpha, 4), "recommendations": final_recs}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import fetch_all_data
from recommender import RecommenderSystem
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tunerate")

recommender = RecommenderSystem()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Uruchamiam aplikację FastAPI – lifespan start")
    try:
        logger.info("🔄 Trenowanie systemu rekomendacji (content-based)...")
        df_reviews, df_albums, df_tags, df_user_albums, df_artists = fetch_all_data()
        logger.info(f"✅ Dane pobrane: reviews={len(df_reviews)}, albums={len(df_albums)}, tags={len(df_tags)}, artists={len(df_artists)}")
        recommender.train(df_reviews, df_albums, df_tags, df_user_albums, df_artists)
        logger.info("✅ System rekomendacji oparty o tagi gotowy.")
    except Exception as e:
        logger.exception("❌ Błąd podczas trenowania modelu")
    yield
    logger.info("🛑 Zamykam aplikację FastAPI – lifespan end")

app = FastAPI(title="TuneRate Content-Based Recommendation Service", lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok", "trained": recommender.trained}

@app.get("/recommend/{user_id}")
def recommend_for_user(user_id: str, top_n: int = 5):
    df_reviews, df_albums, df_tags, df_user_albums, df_artists = fetch_all_data()
    recs = recommender.recommend(user_id, df_reviews, df_albums, df_tags, df_user_albums, top_n)
    return {"user_id": user_id, "recommendations": recs}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

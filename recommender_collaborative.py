import pandas as pd
import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset

class CollaborativeRecommender:
    def __init__(self):
        self.model = None
        self.dataset = None
        self.user_id_map = {}
        self.album_id_map = {}
        self.user_id_inv = {}
        self.album_id_inv = {}
        self.trained = False

    def train(self, df_reviews, df_albums):
        """
        Trenuje model LightFM na podstawie ocen użytkowników.
        """
        if df_reviews.empty or df_albums.empty:
            print("⚠️ Brak danych do trenowania CF.")
            self.trained = False
            return

        df_reviews["UserId"] = df_reviews["UserId"].astype(str)
        df_reviews["AlbumId"] = df_reviews["AlbumId"].astype(str)
        df_albums["Id"] = df_albums["Id"].astype(str)

        dataset = Dataset()
        dataset.fit(
            users=df_reviews["UserId"].unique(),
            items=df_albums["Id"].unique()
        )

        interactions, _ = dataset.build_interactions(
            [(row.UserId, row.AlbumId, float(row.Score)) for _, row in df_reviews.iterrows()]
        )

        model = LightFM(loss='warp')
        model.fit(interactions, epochs=20, num_threads=4)

        self.model = model
        self.dataset = dataset
        self.user_id_map, self.album_id_map, self.user_id_inv, self.album_id_inv = self._create_id_maps(dataset)
        self.trained = True
        print("✅ Model Collaborative Filtering (LightFM) wytrenowany.")

    def _create_id_maps(self, dataset):
        user_id_map, user_feature_map, album_id_map, album_feature_map = dataset.mapping()
        user_id_inv = {v: k for k, v in user_id_map.items()}
        album_id_inv = {v: k for k, v in album_id_map.items()}
        return user_id_map, album_id_map, user_id_inv, album_id_inv

    def recommend(self, user_id, df_albums, df_artists=None, top_n=5, df_reviews=None):
        """
        Zwraca top N rekomendacji dla użytkownika.
        Jeśli df_reviews podane, usuwamy albumy, które użytkownik już ocenił.
        Zwracamy również pole 'score' (surowa predykcja LightFM).
        """
        if not self.trained or self.model is None:
            print("⚠️ Model CF nie został wytrenowany.")
            return []

        user_id = str(user_id)
        if user_id not in self.user_id_map:
            print(f"⚠️ Brak danych dla użytkownika {user_id}.")
            return []

        user_idx = self.user_id_map[user_id]
        n_items = len(self.album_id_map)

        scores = self.model.predict(user_idx, np.arange(n_items))

        album_ids = [self.album_id_inv[i] for i in range(n_items)]
        scores_df = pd.DataFrame({"Id": album_ids, "score": scores})

        if df_reviews is not None and not df_reviews.empty:
            df_reviews_local = df_reviews.copy()
            if "UserId" in df_reviews_local.columns:
                df_reviews_local["UserId"] = df_reviews_local["UserId"].astype(str)
            if "AlbumId" in df_reviews_local.columns:
                df_reviews_local["AlbumId"] = df_reviews_local["AlbumId"].astype(str)
            seen = set(df_reviews_local[df_reviews_local["UserId"] == user_id]["AlbumId"].unique())
            if seen:
                scores_df = scores_df[~scores_df["Id"].isin(seen)]

        scores_df = scores_df.sort_values("score", ascending=False).head(top_n)
        top_ids = scores_df["Id"].astype(str).tolist()

        df_albums["Id"] = df_albums["Id"].astype(str)
        recs = df_albums[df_albums["Id"].isin(top_ids)].copy()
        recs = recs.merge(scores_df, left_on="Id", right_on="Id", how="left")
        recs["__order"] = recs["Id"].apply(lambda x: top_ids.index(x) if x in top_ids else 9999)
        recs = recs.sort_values("__order").drop(columns=["__order"])

        # 🔹 Dołącz nazwę artysty
        if df_artists is not None and not df_artists.empty and "Id" in df_artists.columns:
            recs = recs.merge(
                df_artists[["Id", "Name"]],
                left_on="ArtistId",
                right_on="Id",
                how="left",
                suffixes=("", "_Artist")
            )
            recs.rename(columns={"Name": "Artist"}, inplace=True)
            recs.drop(columns=["Id_Artist"], errors="ignore", inplace=True)
        else:
            recs["Artist"] = None

        rename_map = {
            "Id": "id",
            "Title": "title",
            "Artist": "artist",
            "ArtistId": "artistId",
            "ReleaseDate": "releaseDate",
            "ExternalId": "externalId",
            "CoverUrl": "coverUrl"
        }

        for old_col, new_col in rename_map.items():
            if old_col not in recs.columns:
                recs[old_col] = None

        recs = recs.rename(columns=rename_map)
        final_cols = ["id", "title", "artist", "artistId", "releaseDate", "externalId", "coverUrl", "score"]
        return recs[final_cols].to_dict(orient="records")

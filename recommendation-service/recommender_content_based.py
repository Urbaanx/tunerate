import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

class ContentBasedRecommender:
    def __init__(self):
        self.album_features = None
        self.trained = False

    def train(self, df_reviews, df_albums, df_tags, df_user_albums=None, df_artists=None):
        if df_albums.empty or df_tags.empty:
            print("Brak danych do trenowania systemu.")
            self.trained = False
            return

        # Agregacja tagów dla każdego albumu
        tag_vectors = (
            df_tags.groupby("AlbumId")["Name"]
            .apply(lambda tags: " ".join(tags))
            .reset_index()
        )

        # Tworzenie macierzy cech na podstawie tagów
        tag_matrix = tag_vectors["Name"].str.get_dummies(sep=" ")
        self.album_features = pd.concat([tag_vectors[["AlbumId"]], tag_matrix], axis=1)

        self.album_features["AlbumId"] = self.album_features["AlbumId"].astype(str)
        df_albums["Id"] = df_albums["Id"].astype(str)
        if df_user_albums is not None and "UserId" in df_user_albums.columns:
            df_user_albums["UserId"] = df_user_albums["UserId"].astype(str)
            df_user_albums["AlbumId"] = df_user_albums["AlbumId"].astype(str)
        if "UserId" in df_reviews.columns:
            df_reviews["UserId"] = df_reviews["UserId"].astype(str)
            df_reviews["AlbumId"] = df_reviews["AlbumId"].astype(str)

        self.df_albums = df_albums
        self.df_artists = df_artists if df_artists is not None else pd.DataFrame()

        self.trained = True
        print("System rekomendacji oparty o tagi gotowy.")

    def recommend(self, user_id, df_reviews, df_albums, df_tags, df_user_albums=None, top_n=5):
        if not self.trained or self.album_features is None:
            print("System nie został wytrenowany.")
            return []

        user_id = str(user_id)
        df_reviews_local = df_reviews.copy()
        if "UserId" in df_reviews_local.columns:
            df_reviews_local["UserId"] = df_reviews_local["UserId"].astype(str)
        if "AlbumId" in df_reviews_local.columns:
            df_reviews_local["AlbumId"] = df_reviews_local["AlbumId"].astype(str)

        user_albums = df_reviews_local[df_reviews_local["UserId"] == user_id]["AlbumId"].unique()

        if len(user_albums) == 0 and df_user_albums is not None:
            df_user_albums_local = df_user_albums.copy()
            if "UserId" in df_user_albums_local.columns:
                df_user_albums_local["UserId"] = df_user_albums_local["UserId"].astype(str)
            if "AlbumId" in df_user_albums_local.columns:
                df_user_albums_local["AlbumId"] = df_user_albums_local["AlbumId"].astype(str)
            user_albums = df_user_albums_local[df_user_albums_local["UserId"] == user_id]["AlbumId"].unique()
            print(f"Użytkownik {user_id} ma {len(user_albums)} albumów w kolekcji (brak recenzji).")

        if len(user_albums) == 0:
            print(f"Brak danych dla użytkownika {user_id}.")
            return []

        user_features = self.album_features[self.album_features["AlbumId"].isin(user_albums)].drop(columns=["AlbumId"])
        user_profile = user_features.mean().values.reshape(1, -1)

        album_vectors = self.album_features.drop(columns=["AlbumId"])
        similarities = cosine_similarity(album_vectors, user_profile).flatten()

        recs = pd.DataFrame({
            "AlbumId": self.album_features["AlbumId"],
            "similarity": similarities
        }).sort_values("similarity", ascending=False)

        recs = recs[~recs["AlbumId"].isin(user_albums)]
        top_recs = recs.head(top_n)

        df_albums_local = df_albums.copy()
        if "Id" in df_albums_local.columns:
            df_albums_local["Id"] = df_albums_local["Id"].astype(str)

        recommended_albums = df_albums_local[df_albums_local["Id"].isin(top_recs["AlbumId"])].copy()
        recommended_albums = recommended_albums.merge(
            top_recs[["AlbumId", "similarity"]],
            left_on="Id",
            right_on="AlbumId",
            how="left"
        )
        recommended_albums = recommended_albums.sort_values(by="similarity", ascending=False)

        if not self.df_artists.empty and "Id" in self.df_artists.columns:
            recommended_albums = recommended_albums.merge(
                self.df_artists[["Id", "Name"]],
                left_on="ArtistId",
                right_on="Id",
                how="left",
                suffixes=("", "_Artist")
            )
            recommended_albums.rename(columns={"Name": "Artist"}, inplace=True)
            recommended_albums.drop(columns=["Id_Artist"], errors="ignore", inplace=True)
        else:
            recommended_albums["Artist"] = None

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
            if old_col not in recommended_albums.columns:
                recommended_albums[old_col] = None

        recommended_albums = recommended_albums.rename(columns=rename_map)

        if "similarity" not in recommended_albums.columns:
            recommended_albums["similarity"] = None

        final_cols = ["id", "title", "artist", "artistId", "releaseDate", "externalId", "coverUrl", "similarity"]
        return recommended_albums[final_cols].to_dict(orient="records")
    
    def recommend_similar(self, album_id: str, df_albums, df_tags, df_artists=None, top_n: int = 5):
        """Zwraca podobne albumy na podstawie tagów."""
        if not self.trained or self.album_features is None:
            print("System nie został wytrenowany.")
            return []

        album_id = str(album_id)

        if album_id not in self.album_features["AlbumId"].values:
            print(f"Album {album_id} nie znajduje się w danych tagów.")
            return []

        tag_vectors = self.album_features.set_index("AlbumId")
        sim_matrix = cosine_similarity(tag_vectors)
        sim_df = pd.DataFrame(sim_matrix, index=tag_vectors.index, columns=tag_vectors.index)

        similar_albums = (
            sim_df[album_id]
            .sort_values(ascending=False)
            .drop(album_id)
            .head(top_n)
            .index.tolist()
        )

        df_albums["Id"] = df_albums["Id"].astype(str)
        recs = df_albums[df_albums["Id"].isin(similar_albums)].copy()

        if df_artists is not None and not df_artists.empty:
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
        final_cols = ["id", "title", "artist", "artistId", "releaseDate", "externalId", "coverUrl"]
        return recs[final_cols].to_dict(orient="records")
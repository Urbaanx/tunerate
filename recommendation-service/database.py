import os
import pandas as pd
from sqlalchemy import create_engine

DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "tunerate_db")
DB_USER = os.getenv("DB_USER", "dbuser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "dbpassword")

def get_engine():
    url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url)

def fetch_all_data():
    engine = get_engine()
    df_reviews = pd.read_sql('SELECT * FROM "Reviews"', con=engine)
    df_albums = pd.read_sql('SELECT * FROM "Albums"', con=engine)
    df_tags = pd.read_sql('SELECT * FROM "AlbumTags"', con=engine)
    df_tag_defs = pd.read_sql('SELECT * FROM "Tags"', con=engine)
    df_user_albums = pd.read_sql('SELECT * FROM "UserAlbums"', con=engine)
    df_artists = pd.read_sql('SELECT * FROM "Artists"', con=engine)

    df_tags = df_tags.merge(df_tag_defs, left_on="TagId", right_on="Id", suffixes=("", "_tag"))
    return df_reviews, df_albums, df_tags, df_user_albums, df_artists


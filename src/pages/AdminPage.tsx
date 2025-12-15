import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useGetApiAdminTables,
  useGetApiAdminCounts,
  useGetApiAdminUsers,
  useGetApiAdminArtists,
  useGetApiAdminAlbums,
  useGetApiAdminTags,
  useGetApiAdminAlbumtags,
  useGetApiAdminReviews,
  useGetApiAdminUseralbums,
  useGetApiAdminFriendships,
  useGetApiAdminAlbumshares,
  useGetApiAdminChatmessages,
  usePostApiAdminUsers,
  usePutApiAdminUsersId,
  useDeleteApiAdminUsersId,
  usePostApiAdminArtists,
  usePutApiAdminArtistsId,
  useDeleteApiAdminArtistsId,
  usePostApiAdminAlbums,
  usePutApiAdminAlbumsId,
  useDeleteApiAdminAlbumsId,
  usePostApiAdminTags,
  usePutApiAdminTagsId,
  useDeleteApiAdminTagsId,
  usePostApiAdminAlbumtags,
  useDeleteApiAdminAlbumtagsAlbumIdTagId,
  usePostApiAdminReviews,
  usePutApiAdminReviewsId,
  useDeleteApiAdminReviewsId,
  usePostApiAdminUseralbums,
  usePutApiAdminUseralbumsUserIdAlbumId,
  useDeleteApiAdminUseralbumsUserIdAlbumId,
  usePostApiAdminFriendships,
  usePutApiAdminFriendshipsId,
  useDeleteApiAdminFriendshipsId,
  usePostApiAdminAlbumshares,
  usePutApiAdminAlbumsharesId,
  useDeleteApiAdminAlbumsharesId,
  usePostApiAdminChatmessages,
  usePutApiAdminChatmessagesId,
  useDeleteApiAdminChatmessagesId,
} from "../api/endpoints/tunerateApi";
import { Loader2, Plus, Edit, Trash2, X } from "lucide-react";

type FormState = Record<string, any>;

const AdminPage: React.FC = () => {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [formState, setFormState] = useState<FormState>({});

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<string>("");
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setToken(null);
      return;
    }

    getAccessTokenSilently({
      authorizationParams: {
        audience: audience,
        scope: "openid profile email",
      },
    })
      .then((t) => {
        if (mounted) setToken(t);
      })
      .catch((err) => {
        console.error("AdminPage: token error", err);
        // fallback to interactive consent if required
        if (err?.error === "consent_required") {
          loginWithRedirect({
            authorizationParams: {
              audience,
              scope: "openid profile email",
              prompt: "consent",
            },
          });
        }
        if (mounted) setToken(null);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, getAccessTokenSilently, audience, loginWithRedirect]);

  const authRequest = useMemo(
    () =>
      token
        ? { request: { headers: { Authorization: `Bearer ${token}` } } }
        : undefined,
    [token]
  );

  // build query params for Orval first arg (maps to query string)
  const mkParams = (tableName: string) => {
    // some endpoints don't use sortBy/sortDir/q (but it's okay to pass undefined)
    switch (tableName) {
      default:
        return {
          page,
          pageSize,
          sortBy: sortBy ?? undefined,
          sortDir: sortDir ?? undefined,
          q: filter || undefined,
        } as any;
    }
  };

  // build second-argument options: axios request + react-query options
  const mkRequestOptions = (tableName: string) =>
    token
      ? {
          request: { headers: { Authorization: `Bearer ${token}` } },
          query: { enabled: selectedTable === tableName },
        }
      : { query: { enabled: false } };

  // NOTE: useGetApiAdminTables / useGetApiAdminCounts keep original shape (no params)
  const tablesQuery = useGetApiAdminTables(
    token
      ? {
          request: { headers: { Authorization: `Bearer ${token}` } },
          query: { enabled: true },
        }
      : { query: { enabled: false } }
  );
  const countsQuery = useGetApiAdminCounts(
    token
      ? {
          request: { headers: { Authorization: `Bearer ${token}` } },
          query: { enabled: true },
        }
      : { query: { enabled: false } }
  );

  // per-table queries (params, options)
  const usersQuery = useGetApiAdminUsers<any, unknown>(
    mkParams("Users"),
    mkRequestOptions("Users")
  );
  const artistsQuery = useGetApiAdminArtists<any, unknown>(
    mkParams("Artists"),
    mkRequestOptions("Artists")
  );
  const albumsQuery = useGetApiAdminAlbums<any, unknown>(
    mkParams("Albums"),
    mkRequestOptions("Albums")
  );
  const tagsQuery = useGetApiAdminTags<any, unknown>(
    mkParams("Tags"),
    mkRequestOptions("Tags")
  );
  const albumTagsQuery = useGetApiAdminAlbumtags<any, unknown>(
    mkParams("AlbumTags"),
    mkRequestOptions("AlbumTags")
  );
  const reviewsQuery = useGetApiAdminReviews<any, unknown>(
    mkParams("Reviews"),
    mkRequestOptions("Reviews")
  );
  const userAlbumsQuery = useGetApiAdminUseralbums<any, unknown>(
    mkParams("UserAlbums"),
    mkRequestOptions("UserAlbums")
  );
  const friendshipsQuery = useGetApiAdminFriendships<any, unknown>(
    mkParams("Friendships"),
    mkRequestOptions("Friendships")
  );
  const albumSharesQuery = useGetApiAdminAlbumshares<any, unknown>(
    mkParams("AlbumShares"),
    mkRequestOptions("AlbumShares")
  );
  const chatMessagesQuery = useGetApiAdminChatmessages<any, unknown>(
    mkParams("ChatMessages"),
    mkRequestOptions("ChatMessages")
  );

  // mutations
  const postUsers = usePostApiAdminUsers<any, unknown>(
    authRequest ?? undefined
  );
  const putUser = usePutApiAdminUsersId<any, unknown>(authRequest ?? undefined);
  const deleteUser = useDeleteApiAdminUsersId<any, unknown>(
    authRequest ?? undefined
  );

  const postArtists = usePostApiAdminArtists<any, unknown>(
    authRequest ?? undefined
  );
  const putArtist = usePutApiAdminArtistsId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteArtist = useDeleteApiAdminArtistsId<any, unknown>(
    authRequest ?? undefined
  );

  const postAlbums = usePostApiAdminAlbums<any, unknown>(
    authRequest ?? undefined
  );
  const putAlbum = usePutApiAdminAlbumsId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteAlbum = useDeleteApiAdminAlbumsId<any, unknown>(
    authRequest ?? undefined
  );

  const postTags = usePostApiAdminTags<any, unknown>(authRequest ?? undefined);
  const putTag = usePutApiAdminTagsId<any, unknown>(authRequest ?? undefined);
  const deleteTag = useDeleteApiAdminTagsId<any, unknown>(
    authRequest ?? undefined
  );

  const postAlbumTag = usePostApiAdminAlbumtags<any, unknown>(
    authRequest ?? undefined
  );
  const deleteAlbumTag = useDeleteApiAdminAlbumtagsAlbumIdTagId<any, unknown>(
    authRequest ?? undefined
  );

  const postReviews = usePostApiAdminReviews<any, unknown>(
    authRequest ?? undefined
  );
  const putReview = usePutApiAdminReviewsId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteReview = useDeleteApiAdminReviewsId<any, unknown>(
    authRequest ?? undefined
  );

  const postUserAlbum = usePostApiAdminUseralbums<any, unknown>(
    authRequest ?? undefined
  );
  const putUserAlbum = usePutApiAdminUseralbumsUserIdAlbumId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteUserAlbum = useDeleteApiAdminUseralbumsUserIdAlbumId<
    any,
    unknown
  >(authRequest ?? undefined);

  const postFriendship = usePostApiAdminFriendships<any, unknown>(
    authRequest ?? undefined
  );
  const putFriendship = usePutApiAdminFriendshipsId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteFriendship = useDeleteApiAdminFriendshipsId<any, unknown>(
    authRequest ?? undefined
  );

  const postAlbumShare = usePostApiAdminAlbumshares<any, unknown>(
    authRequest ?? undefined
  );
  const putAlbumShare = usePutApiAdminAlbumsharesId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteAlbumShare = useDeleteApiAdminAlbumsharesId<any, unknown>(
    authRequest ?? undefined
  );

  const postChatMessage = usePostApiAdminChatmessages<any, unknown>(
    authRequest ?? undefined
  );
  const putChatMessage = usePutApiAdminChatmessagesId<any, unknown>(
    authRequest ?? undefined
  );
  const deleteChatMessage = useDeleteApiAdminChatmessagesId<any, unknown>(
    authRequest ?? undefined
  );

  // rows (robust extraction from Orval response)
  const extractItems = (raw: any): any[] => {
    if (!raw) return [];
    // already an array
    if (Array.isArray(raw)) return raw;
    // common paged shapes
    if (raw.Items && Array.isArray(raw.Items)) return raw.Items;
    if (raw.items && Array.isArray(raw.items)) return raw.items;
    // sometimes axios/orval wraps under .data
    if (raw.data) {
      const d = raw.data;
      if (Array.isArray(d)) return d;
      if (d.Items && Array.isArray(d.Items)) return d.Items;
      if (d.items && Array.isArray(d.items)) return d.items;
    }
    return [];
  };

  const raw = (() => {
    switch (selectedTable) {
      case "Users":
        return usersQuery.data;
      case "Artists":
        return artistsQuery.data;
      case "Albums":
        return albumsQuery.data;
      case "Tags":
        return tagsQuery.data;
      case "AlbumTags":
        return albumTagsQuery.data;
      case "Reviews":
        return reviewsQuery.data;
      case "UserAlbums":
        return userAlbumsQuery.data;
      case "Friendships":
        return friendshipsQuery.data;
      case "AlbumShares":
        return albumSharesQuery.data;
      case "ChatMessages":
        return chatMessagesQuery.data;
      default:
        return null;
    }
  })();

  const rows = extractItems(raw);

  // only treat auth/token/tables/counts as global loading — per-table loading
  // should not replace the whole UI (prevents input losing focus).
  const loading =
    !isAuthenticated ||
    !token ||
    tablesQuery.isLoading ||
    countsQuery.isLoading;

  // helper: derive columns from first row (guarded)
  const columns = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const first = rows[0];
    if (!first || typeof first !== "object") return [];
    // include only primitive properties and "*Id" fields
    return Object.keys(first).filter((k) => {
      const v = first[k];
      if (v === null || v === undefined) return true; // show unknown fields
      const t = typeof v;
      if (t === "string" || t === "number" || t === "boolean") return true;
      // include id fields (guid strings)
      if (k.toLowerCase().endsWith("id")) return true;
      return false;
    });
  }, [rows]);

  const openNew = () => {
    setIsNew(true);
    setSelectedRow(null);
    // default formState: attempt to use column keys with empty values
    const template: FormState = {};
    columns.forEach((c) => (template[c] = ""));
    setFormState(template);
    setFormOpen(true);
  };

  const openEdit = (row: any) => {
    setIsNew(false);
    setSelectedRow(row);
    // flatten row to primitives: if nested object has Id, prefer its Id
    const flat: FormState = {};
    Object.entries(row).forEach(([k, v]) => {
      if (v && typeof v === "object") {
        // prefer <Name>Id or Id inside nested object
        const obj = v as any;
        if (obj.id) flat[`${k}Id`] = obj.id;
        else if (obj.Id) flat[`${k}Id`] = obj.Id;
        // ignore full objects
      } else {
        flat[k] = v;
      }
    });
    // ensure columns presence
    columns.forEach((c) => {
      if (!(c in flat)) flat[c] = "";
    });
    setFormState(flat);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedRow(null);
    setFormState({});
  };

  // helpers to format date strings to yyyy-MM-dd for <input type="date">
  const toDateInput = (val: any) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fromDateInput = (s: string) => {
    if (!s) return null;
    return new Date(s);
  };

  // Create / Update generic handlers (map formState -> API call depending on table)
  const handleSubmit = async () => {
    // copy and coerce values
    const payload: any = {};
    Object.entries(formState).forEach(([k, v]) => {
      // try to coerce booleans/numbers/dates
      if (v === "true" || v === "false") payload[k] = v === "true";
      else if (
        typeof v === "string" &&
        /^\d+$/.test(v) &&
        !k.toLowerCase().endsWith("id")
      )
        payload[k] = Number(v);
      else payload[k] = v;
    });

    try {
      switch (selectedTable) {
        case "Users":
          if (isNew)
            postUsers.mutate(
              { data: payload },
              { onSuccess: () => usersQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putUser.mutate(
              { id, data: payload },
              { onSuccess: () => usersQuery.refetch() }
            );
          }
          break;

        case "Artists":
          if (isNew)
            postArtists.mutate(
              { data: payload },
              { onSuccess: () => artistsQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putArtist.mutate(
              { id, data: payload },
              { onSuccess: () => artistsQuery.refetch() }
            );
          }
          break;

        case "Albums":
          if (isNew)
            postAlbums.mutate(
              { data: payload },
              { onSuccess: () => albumsQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            // coerce date fields
            if (payload.ReleaseDate && typeof payload.ReleaseDate === "string")
              payload.ReleaseDate = fromDateInput(payload.ReleaseDate);
            putAlbum.mutate(
              { id, data: payload },
              { onSuccess: () => albumsQuery.refetch() }
            );
          }
          break;

        case "Tags":
          if (isNew)
            postTags.mutate(
              { data: payload },
              { onSuccess: () => tagsQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putTag.mutate(
              { id, data: payload },
              { onSuccess: () => tagsQuery.refetch() }
            );
          }
          break;

        case "AlbumTags":
          if (isNew)
            postAlbumTag.mutate(
              { data: payload },
              { onSuccess: () => albumTagsQuery.refetch() }
            );
          else {
            // update not supported for composite: recreate
            alert(
              "Edytowanie AlbumTag nieobsługiwane — utwórz nowy lub usuń istniejący."
            );
          }
          break;

        case "Reviews":
          if (isNew)
            postReviews.mutate(
              { data: payload },
              { onSuccess: () => reviewsQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putReview.mutate(
              { id, data: payload },
              { onSuccess: () => reviewsQuery.refetch() }
            );
          }
          break;

        case "UserAlbums":
          if (isNew)
            postUserAlbum.mutate(
              { data: payload },
              { onSuccess: () => userAlbumsQuery.refetch() }
            );
          else {
            const userId = String(
              selectedRow.userId ?? selectedRow.UserId ?? selectedRow.User?.Id
            );
            const albumId = String(
              selectedRow.albumId ??
                selectedRow.AlbumId ??
                selectedRow.Album?.Id
            );
            putUserAlbum.mutate(
              { userId, albumId, data: payload },
              { onSuccess: () => userAlbumsQuery.refetch() }
            );
          }
          break;

        case "Friendships":
          if (isNew)
            postFriendship.mutate(
              { data: payload },
              { onSuccess: () => friendshipsQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putFriendship.mutate(
              { id, data: payload },
              { onSuccess: () => friendshipsQuery.refetch() }
            );
          }
          break;

        case "AlbumShares":
          if (isNew)
            postAlbumShare.mutate(
              { data: payload },
              { onSuccess: () => albumSharesQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putAlbumShare.mutate(
              { id, data: payload },
              { onSuccess: () => albumSharesQuery.refetch() }
            );
          }
          break;

        case "ChatMessages":
          if (isNew)
            postChatMessage.mutate(
              { data: payload },
              { onSuccess: () => chatMessagesQuery.refetch() }
            );
          else {
            const id = String(selectedRow.id ?? selectedRow.Id);
            putChatMessage.mutate(
              { id, data: payload },
              { onSuccess: () => chatMessagesQuery.refetch() }
            );
          }
          break;

        default:
          alert("Nieobsługiwana tabela.");
      }

      closeForm();
      countsQuery.refetch();
    } catch (err) {
      console.error(err);
      alert("Błąd zapisu: " + String(err));
    }
  };

  const handleDelete = async (row: any) => {
    if (!confirm("Na pewno usunąć ten rekord?")) return;
    try {
      switch (selectedTable) {
        case "Users": {
          const id = String(row.id ?? row.Id);
          deleteUser.mutate({ id }, { onSuccess: () => usersQuery.refetch() });
          break;
        }
        case "Artists": {
          const id = String(row.id ?? row.Id);
          deleteArtist.mutate(
            { id },
            { onSuccess: () => artistsQuery.refetch() }
          );
          break;
        }
        case "Albums": {
          const id = String(row.id ?? row.Id);
          deleteAlbum.mutate(
            { id },
            { onSuccess: () => albumsQuery.refetch() }
          );
          break;
        }
        case "Tags": {
          const id = String(row.id ?? row.Id);
          deleteTag.mutate({ id }, { onSuccess: () => tagsQuery.refetch() });
          break;
        }
        case "AlbumTags": {
          const albumId = String(row.albumId ?? row.AlbumId ?? row.Album?.Id);
          const tagId = String(row.tagId ?? row.TagId ?? row.Tag?.Id);
          deleteAlbumTag.mutate(
            { albumId, tagId },
            { onSuccess: () => albumTagsQuery.refetch() }
          );
          break;
        }
        case "Reviews": {
          const id = String(row.id ?? row.Id);
          deleteReview.mutate(
            { id },
            { onSuccess: () => reviewsQuery.refetch() }
          );
          break;
        }
        case "UserAlbums": {
          const userId = String(row.userId ?? row.UserId ?? row.User?.Id);
          const albumId = String(row.albumId ?? row.AlbumId ?? row.Album?.Id);
          deleteUserAlbum.mutate(
            { userId, albumId },
            { onSuccess: () => userAlbumsQuery.refetch() }
          );
          break;
        }
        case "Friendships": {
          const id = String(row.id ?? row.Id);
          deleteFriendship.mutate(
            { id },
            { onSuccess: () => friendshipsQuery.refetch() }
          );
          break;
        }
        case "AlbumShares": {
          const id = String(row.id ?? row.Id);
          deleteAlbumShare.mutate(
            { id },
            { onSuccess: () => albumSharesQuery.refetch() }
          );
          break;
        }
        case "ChatMessages": {
          const id = String(row.id ?? row.Id);
          deleteChatMessage.mutate(
            { id },
            { onSuccess: () => chatMessagesQuery.refetch() }
          );
          break;
        }
        default:
          alert("Nieobsługiwana tabela.");
      }
      countsQuery.refetch();
    } catch (err) {
      console.error(err);
      alert("Błąd usuwania: " + String(err));
    }
  };

  useEffect(() => {
    setPage(1);
    setFilter("");
    setSortBy(null);
    setSortDir("desc");
  }, [selectedTable]);

  useEffect(() => {
    const data = (() => {
      switch (selectedTable) {
        case "Users":
          return usersQuery.data;
        case "Artists":
          return artistsQuery.data;
        case "Albums":
          return albumsQuery.data;
        case "Tags":
          return tagsQuery.data;
        case "AlbumTags":
          return albumTagsQuery.data;
        case "Reviews":
          return reviewsQuery.data;
        case "UserAlbums":
          return userAlbumsQuery.data;
        case "Friendships":
          return friendshipsQuery.data;
        case "AlbumShares":
          return albumSharesQuery.data;
        case "ChatMessages":
          return chatMessagesQuery.data;
        default:
          return null;
      }
    })();

    let total: number | null = null;
    if (data) {
      if ((data as any).TotalCount !== undefined)
        total = Number((data as any).TotalCount);
      else if ((data as any).totalCount !== undefined)
        total = Number((data as any).totalCount);
      else if ((data as any).total !== undefined)
        total = Number((data as any).total);
      else if ((data as any).Total !== undefined)
        total = Number((data as any).Total);
      else if ((data as any).items && (data as any).items.total !== undefined)
        total = Number((data as any).items.total);
      // otherwise leave null
    }
    setTotalCount(total);
  }, [
    selectedTable,
    usersQuery.data,
    artistsQuery.data,
    albumsQuery.data,
    tagsQuery.data,
    albumTagsQuery.data,
    reviewsQuery.data,
    userAlbumsQuery.data,
    friendshipsQuery.data,
    albumSharesQuery.data,
    chatMessagesQuery.data,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white">
        <h1 className="text-3xl font-bold mb-4">Musisz się zalogować</h1>
        <button
          onClick={() => loginWithRedirect()}
          className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Zaloguj się
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        <Loader2 className="animate-spin w-8 h-8 mr-3" />
        <span>Wczytywanie danych administracyjnych...</span>
      </div>
    );
  }

  const tableList = tablesQuery.data ?? [
    "Users",
    "Artists",
    "Albums",
    "Tags",
    "AlbumTags",
    "Reviews",
    "UserAlbums",
    "Friendships",
    "AlbumShares",
    "ChatMessages",
  ];
  const counts = countsQuery.data ?? {};

  return (
    <div className="p-6 max-w-7xl mx-auto grid grid-cols-4 gap-6">
      <aside className="col-span-1 bg-black/40 border border-white/10 rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Tabele</h2>
        <ul className="space-y-2">
          {tableList.map((t: string) => (
            <li key={t}>
              <button
                onClick={() => setSelectedTable(t)}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedTable === t ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t}</span>
                  <span className="text-xs text-gray-300">
                    {(counts as any)[t] ?? "-"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">
            {selectedTable ?? "Wybierz tabelę"}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                openNew();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 rounded hover:bg-green-700"
            >
              <Plus className="w-4 h-4" /> Nowy
            </button>
            <button
              onClick={() => {
                if (selectedTable) {
                  /* refetch current */ switch (selectedTable) {
                    case "Users":
                      usersQuery.refetch();
                      break;
                    case "Artists":
                      artistsQuery.refetch();
                      break;
                    case "Albums":
                      albumsQuery.refetch();
                      break;
                    case "Tags":
                      tagsQuery.refetch();
                      break;
                    case "AlbumTags":
                      albumTagsQuery.refetch();
                      break;
                    case "Reviews":
                      reviewsQuery.refetch();
                      break;
                    case "UserAlbums":
                      userAlbumsQuery.refetch();
                      break;
                    case "Friendships":
                      friendshipsQuery.refetch();
                      break;
                    case "AlbumShares":
                      albumSharesQuery.refetch();
                      break;
                    case "ChatMessages":
                      chatMessagesQuery.refetch();
                      break;
                  }
                  countsQuery.refetch();
                }
              }}
              className="px-3 py-2 bg-white/6 rounded hover:bg-white/10"
            >
              Odśwież
            </button>
          </div>
        </div>

        {!selectedTable ? (
          <div className="text-gray-300">
            Wybierz tabelę z panelu po lewej, aby zobaczyć rekordy.
          </div>
        ) : (
          <div className="bg-black/40 border border-white/10 rounded p-4 overflow-auto">
            <div className="flex items-center gap-2 mb-4">
              <input
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Szukaj..."
                className="p-2 bg-black/30 text-white rounded border border-white/10"
              />
              <select
                value={sortBy ?? ""}
                onChange={(e) => {
                  setSortBy(e.target.value || null);
                  setPage(1);
                }}
                className="p-2 bg-black/30 text-white rounded border border-white/10"
              >
                <option value="">-- sortuj --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                className="p-2 bg-black/30 text-white rounded border border-white/10"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="p-2 bg-black/30 text-white rounded border border-white/10"
              >
                {[10, 20, 50, 100].map((s) => (
                  <option key={s} value={s}>
                    {s}/str
                  </option>
                ))}
              </select>
            </div>

            <table className="min-w-full table-auto text-sm">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-gray-200">
                      {col}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="text-gray-400 px-3 py-4"
                    >
                      Brak rekordów
                    </td>
                  </tr>
                ) : (
                  rows.map((r: any, idx: number) => (
                    <tr
                      key={r.id ?? r.Id ?? idx}
                      className="border-t border-white/5"
                    >
                      {columns.map((col) => {
                        const v = r[col];
                        const display = (() => {
                          if (v === null || v === undefined) return "";
                          if (typeof v === "string" && v.length > 60)
                            return v.slice(0, 57) + "...";
                          if (typeof v === "object") return JSON.stringify(v);
                          return String(v);
                        })();
                        return (
                          <td key={col} className="px-3 py-2 align-top">
                            {display}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            title="Edytuj"
                            onClick={() => openEdit(r)}
                            className="p-1 rounded bg-white/6 hover:bg-white/10"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            title="Usuń"
                            onClick={() => handleDelete(r)}
                            className="p-1 rounded bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-gray-300">
                {totalCount !== null
                  ? `Strona ${page} — ${totalCount} wyników`
                  : `Strona ${page}`}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white/6 rounded disabled:opacity-50"
                >
                  Poprzednia
                </button>
                <button
                  disabled={
                    totalCount !== null && page * pageSize >= totalCount
                  }
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 bg-white/6 rounded disabled:opacity-50"
                >
                  Następna
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeForm} />
          <div className="relative z-60 w-full max-w-3xl bg-black border border-white/10 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {isNew ? "Nowy" : "Edytuj"} — {selectedTable}
              </h3>
              <button
                onClick={closeForm}
                className="p-1 rounded bg-white/6 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
              {columns.map((col) => {
                const cur = formState[col];
                // detect type heuristically
                const type = (() => {
                  if (col.toLowerCase().endsWith("id")) return "text";
                  if (typeof cur === "boolean") return "checkbox";
                  if (typeof cur === "number") return "number";
                  // date-like string check (ISO)
                  if (
                    typeof cur === "string" &&
                    /^\d{4}-\d{2}-\d{2}T/.test(cur)
                  )
                    return "date";
                  return "text";
                })();

                return (
                  <div key={col} className="flex flex-col">
                    <label className="text-sm text-gray-300 mb-1">{col}</label>
                    {type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={!!formState[col]}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            [col]: e.target.checked,
                          }))
                        }
                      />
                    ) : type === "number" ? (
                      <input
                        type="number"
                        value={formState[col] ?? ""}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            [col]:
                              e.target.value !== ""
                                ? Number(e.target.value)
                                : "",
                          }))
                        }
                        className="p-2 bg-black/30 text-white rounded border border-white/10"
                      />
                    ) : type === "date" ? (
                      <input
                        type="date"
                        value={toDateInput(formState[col])}
                        onChange={(e) =>
                          setFormState((s) => ({ ...s, [col]: e.target.value }))
                        }
                        className="p-2 bg-black/30 text-white rounded border border-white/10"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formState[col] ?? ""}
                        onChange={(e) =>
                          setFormState((s) => ({ ...s, [col]: e.target.value }))
                        }
                        className="p-2 bg-black/30 text-white rounded border border-white/10"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={closeForm}
                className="px-4 py-2 bg-white/6 rounded hover:bg-white/10"
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                {isNew ? "Utwórz" : "Zapisz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

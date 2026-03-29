import { useEffect, useMemo, useRef, useState } from "react";
import {
  SignInButton,
  SignOutButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser
} from "@clerk/clerk-react";
import { NavLink, Route, Routes } from "react-router-dom";
import { featuredAlbums, playlists, tracks } from "./data/tracks";

const likesStorageKey = "sonic-stream-liked-tracks";
const guestStorageKey = "sonic-stream-guest-mode";

function App({ clerkEnabled }) {
  if (!clerkEnabled) {
    return <SonicStreamApp clerkEnabled={false} user={null} />;
  }

  return <ClerkEnabledApp />;
}

function ClerkEnabledApp() {
  const { user } = useUser();
  return <SonicStreamApp clerkEnabled user={user} />;
}

function SonicStreamApp({ clerkEnabled, user }) {
  const audioRef = useRef(null);
  const [likedTrackIds, setLikedTrackIds] = useState(() => {
    const rawValue = window.localStorage.getItem(likesStorageKey);
    return rawValue ? JSON.parse(rawValue) : [];
  });
  const [isGuest, setIsGuest] = useState(
    () => window.localStorage.getItem(guestStorageKey) === "true"
  );
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState(tracks);
  const [currentTrackId, setCurrentTrackId] = useState(tracks[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [progress, setProgress] = useState(0);

  const listenerName = user?.firstName || user?.username || (isGuest ? "Guest" : "Everyone");
  const currentTrack = useMemo(
    () => queue.find((track) => track.id === currentTrackId) || queue[0],
    [currentTrackId, queue]
  );
  const likedTracks = useMemo(
    () => tracks.filter((track) => likedTrackIds.includes(track.id)),
    [likedTrackIds]
  );
  const filteredTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return tracks;
    }

    return tracks.filter((track) =>
      `${track.title} ${track.artist} ${track.album} ${track.mood}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query]);

  useEffect(() => {
    window.localStorage.setItem(likesStorageKey, JSON.stringify(likedTrackIds));
  }, [likedTrackIds]);

  useEffect(() => {
    window.localStorage.setItem(guestStorageKey, isGuest ? "true" : "false");
  }, [isGuest]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return undefined;
    }

    audio.volume = volume;

    const handleTimeUpdate = () => {
      if (!audio.duration) {
        setProgress(0);
        return;
      }

      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);
      const nextTrack = queue[(currentIndex + 1) % queue.length];
      setCurrentTrackId(nextTrack.id);
      setIsPlaying(true);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentTrack, queue, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    audio.load();

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack, isPlaying]);

  const togglePlayback = () => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const playTrack = (track, sourceQueue = queue) => {
    setQueue(sourceQueue);
    setCurrentTrackId(track.id);
    setProgress(0);
    setIsPlaying(true);
  };

  const goToTrack = (direction) => {
    const activeQueue = queue.length ? queue : tracks;
    const currentIndex = activeQueue.findIndex((track) => track.id === currentTrackId);
    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % activeQueue.length
        : (currentIndex - 1 + activeQueue.length) % activeQueue.length;

    setCurrentTrackId(activeQueue[nextIndex].id);
    setIsPlaying(true);
    setProgress(0);
  };

  const toggleLike = (trackId) => {
    setLikedTrackIds((previous) =>
      previous.includes(trackId)
        ? previous.filter((id) => id !== trackId)
        : [...previous, trackId]
    );
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;

    if (!audio || !audio.duration) {
      return;
    }

    const nextProgress = Number(event.target.value);
    audio.currentTime = (nextProgress / 100) * audio.duration;
    setProgress(nextProgress);
  };

  return (
    <div className="app-shell">
      <audio ref={audioRef}>
        {currentTrack ? <source src={currentTrack.audioSrc} type="audio/mpeg" /> : null}
      </audio>

      <div className="dashboard">
        <Sidebar
          clerkEnabled={clerkEnabled}
          isGuest={isGuest}
          likedCount={likedTracks.length}
          listenerName={listenerName}
          onGuestToggle={() => setIsGuest((value) => !value)}
        />

        <div className="main-column">
          <Topbar
            clerkEnabled={clerkEnabled}
            currentTrack={currentTrack}
            isGuest={isGuest}
            listenerName={listenerName}
            query={query}
            onGuestToggle={() => setIsGuest((value) => !value)}
            onQueryChange={setQuery}
          />

          <Routes>
            <Route
              path="/"
              element={
                <HomeRoute
                  currentTrack={currentTrack}
                  featuredAlbums={featuredAlbums}
                  likedTrackIds={likedTrackIds}
                  likedTracks={likedTracks}
                  listenerName={listenerName}
                  onPlayTrack={playTrack}
                  onToggleLike={toggleLike}
                />
              }
            />
            <Route
              path="/search"
              element={
                <SearchRoute
                  filteredTracks={filteredTracks}
                  likedTrackIds={likedTrackIds}
                  onPlayTrack={playTrack}
                  onToggleLike={toggleLike}
                />
              }
            />
            <Route
              path="/library"
              element={
                <LibraryRoute
                  likedTrackIds={likedTrackIds}
                  likedTracks={likedTracks}
                  onPlayTrack={playTrack}
                  onToggleLike={toggleLike}
                />
              }
            />
            <Route
              path="/liked"
              element={
                <LikedRoute
                  likedTracks={likedTracks}
                  onPlayTrack={playTrack}
                  onToggleLike={toggleLike}
                />
              }
            />
          </Routes>
        </div>

        <NowPlayingPanel
          currentTrack={currentTrack}
          isLiked={likedTrackIds.includes(currentTrack?.id)}
          isPlaying={isPlaying}
          progress={progress}
          volume={volume}
          onNext={() => goToTrack("next")}
          onPrevious={() => goToTrack("previous")}
          onProgressChange={handleSeek}
          onToggleLike={() => toggleLike(currentTrack.id)}
          onTogglePlayback={togglePlayback}
          onVolumeChange={(event) => setVolume(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

function Sidebar({ clerkEnabled, isGuest, likedCount, listenerName, onGuestToggle }) {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand-mark">
          <span className="brand-ring" />
          <div>
            <p className="eyebrow">Premium feel</p>
            <h2>Sonic Stream</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarLink to="/">Home</SidebarLink>
          <SidebarLink to="/search">Search</SidebarLink>
          <SidebarLink to="/library">Your Library</SidebarLink>
          <SidebarLink to="/liked">Liked Songs</SidebarLink>
        </nav>

        <div className="playlist-block">
          <p className="sidebar-heading">Collections</p>
          {playlists.map((playlist) => (
            <div key={playlist} className="playlist-item">
              {playlist}
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="listener-card">
          <p className="sidebar-heading">Listening as</p>
          <strong>{listenerName}</strong>
          <span>{likedCount} liked songs saved locally</span>
        </div>

        <div className="account-actions">
          {clerkEnabled ? <ClerkControls /> : null}
          <button className="ghost-button" onClick={onGuestToggle}>
            {isGuest ? "Disable guest mode" : "Continue as guest"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ClerkControls() {
  return (
    <>
      <SignedOut>
        <div className="account-button-row">
          <SignInButton mode="modal">
            <button className="primary-button">Sign in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="secondary-button">Sign up</button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="user-row">
          <UserButton afterSignOutUrl="/" />
          <SignOutButton>
            <button className="ghost-button">Sign out</button>
          </SignOutButton>
        </div>
      </SignedIn>
    </>
  );
}

function SidebarLink({ children, to }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

function Topbar({
  clerkEnabled,
  currentTrack,
  isGuest,
  listenerName,
  query,
  onGuestToggle,
  onQueryChange
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Now trending</p>
        <h3>{currentTrack.title}</h3>
        <p className="topbar-subtext">
          {currentTrack.artist} - {currentTrack.album}
        </p>
      </div>
      <div className="topbar-actions">
        <label className="search-box">
          <span>Search</span>
          <input
            type="search"
            placeholder="Artists, songs, albums"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <div className="status-pill">
          {isGuest ? "Guest mode" : clerkEnabled ? `Hi, ${listenerName}` : "Open access"}
        </div>
        <button className="ghost-button mobile-guest-toggle" onClick={onGuestToggle}>
          {isGuest ? "Guest on" : "Guest off"}
        </button>
      </div>
    </header>
  );
}

function HomeRoute({
  currentTrack,
  featuredAlbums,
  likedTrackIds,
  likedTracks,
  listenerName,
  onPlayTrack,
  onToggleLike
}) {
  return (
    <div className="route-grid">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Made for {listenerName}</p>
          <h1>The Sonic Stream edition of a premium music dashboard.</h1>
          <p className="lede">
            Responsive, playable, and tuned for dark red and green. Likes persist
            locally and show up instantly across the app.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onPlayTrack(currentTrack, tracks)}>
              Play now
            </button>
            <NavLink to="/liked" className="secondary-button text-button">
              Open liked songs
            </NavLink>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <span>{tracks.length}</span>
            <p>playable tracks</p>
          </div>
          <div>
            <span>{likedTracks.length}</span>
            <p>songs you liked</p>
          </div>
          <div>
            <span>All</span>
            <p>routes open to every visitor</p>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Featured mixes</h2>
          <span>Spotify-inspired cards with Sonic Stream styling</span>
        </div>
        <div className="album-grid">
          {featuredAlbums.map((album) => (
            <article
              key={album.id}
              className="album-card"
              style={{ background: album.accent }}
            >
              <p className="eyebrow">Playlist</p>
              <h3>{album.title}</h3>
              <p>{album.subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Popular right now</h2>
          <span>Jump in from home or like tracks for later</span>
        </div>
        <TrackList
          emptyMessage="No tracks available."
          likedTrackIds={likedTrackIds}
          onPlayTrack={onPlayTrack}
          onToggleLike={onToggleLike}
          tracks={tracks}
        />
      </section>
    </div>
  );
}

function SearchRoute({ filteredTracks, likedTrackIds, onPlayTrack, onToggleLike }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <h2>Search results</h2>
        <span>Live filter across songs, albums, artists, and moods</span>
      </div>
      <TrackList
        emptyMessage="No songs matched your search."
        likedTrackIds={likedTrackIds}
        onPlayTrack={onPlayTrack}
        onToggleLike={onToggleLike}
        tracks={filteredTracks}
      />
    </section>
  );
}

function LibraryRoute({ likedTrackIds, likedTracks, onPlayTrack, onToggleLike }) {
  return (
    <div className="route-grid">
      <section className="highlight-card">
        <p className="eyebrow">Your library</p>
        <h2>Keep listening across the whole app.</h2>
        <p className="lede">
          Likes, search, and full playback controls stay available on every route.
        </p>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>All songs</h2>
          <span>{likedTrackIds.length} songs liked so far</span>
        </div>
        <TrackList
          emptyMessage="No songs available."
          likedTrackIds={likedTrackIds}
          onPlayTrack={onPlayTrack}
          onToggleLike={onToggleLike}
          tracks={tracks}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Your liked songs</h2>
          <span>Saved locally and visible immediately</span>
        </div>
        <TrackList
          emptyMessage="Like a song and it will appear here."
          likedTrackIds={likedTrackIds}
          onPlayTrack={onPlayTrack}
          onToggleLike={onToggleLike}
          tracks={likedTracks}
        />
      </section>
    </div>
  );
}

function LikedRoute({ likedTracks, onPlayTrack, onToggleLike }) {
  const likedIds = likedTracks.map((track) => track.id);

  return (
    <section className="section-block">
      <div className="section-heading">
        <h2>Liked songs</h2>
        <span>Your personal Sonic Stream favorites</span>
      </div>
      <TrackList
        emptyMessage="Nothing liked yet. Tap the heart on any song."
        likedTrackIds={likedIds}
        onPlayTrack={onPlayTrack}
        onToggleLike={onToggleLike}
        tracks={likedTracks}
      />
    </section>
  );
}

function TrackList({ emptyMessage, likedTrackIds, onPlayTrack, onToggleLike, tracks }) {
  if (!tracks.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="track-list">
      {tracks.map((track, index) => (
        <article key={track.id} className="track-row">
          <button className="track-main" onClick={() => onPlayTrack(track, tracks)}>
            <div className="track-index">{String(index + 1).padStart(2, "0")}</div>
            <img src={track.cover} alt={track.title} className="track-cover" />
            <div className="track-meta">
              <strong>{track.title}</strong>
              <span>
                {track.artist} - {track.album}
              </span>
            </div>
            <div className="track-tag">{track.mood}</div>
            <div className="track-plays">{track.plays}</div>
            <div className="track-duration">{track.duration}</div>
          </button>
          <button
            className={`like-button${likedTrackIds.includes(track.id) ? " liked" : ""}`}
            onClick={() => onToggleLike(track.id)}
            aria-label={likedTrackIds.includes(track.id) ? "Unlike song" : "Like song"}
          >
            {likedTrackIds.includes(track.id) ? "Liked" : "Like"}
          </button>
        </article>
      ))}
    </div>
  );
}

function NowPlayingPanel({
  currentTrack,
  isLiked,
  isPlaying,
  progress,
  volume,
  onNext,
  onPrevious,
  onProgressChange,
  onToggleLike,
  onTogglePlayback,
  onVolumeChange
}) {
  if (!currentTrack) {
    return null;
  }

  return (
    <aside className="now-playing">
      <div className="now-playing-card">
        <img src={currentTrack.cover} alt={currentTrack.title} className="now-cover" />
        <p className="eyebrow">Now playing</p>
        <h2>{currentTrack.title}</h2>
        <p className="lede">
          {currentTrack.artist} - {currentTrack.album}
        </p>

        <div className="player-actions">
          <button className="ghost-button control-button" onClick={onPrevious}>
            Prev
          </button>
          <button className="play-button" onClick={onTogglePlayback}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button className="ghost-button control-button" onClick={onNext}>
            Next
          </button>
        </div>

        <button className={`like-button large${isLiked ? " liked" : ""}`} onClick={onToggleLike}>
          {isLiked ? "In your likes" : "Add to likes"}
        </button>

        <label className="slider-group">
          <span>Track progress</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={onProgressChange}
          />
        </label>

        <label className="slider-group">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={onVolumeChange}
          />
        </label>

        <div className="track-facts">
          <div>
            <span>Mood</span>
            <strong>{currentTrack.mood}</strong>
          </div>
          <div>
            <span>Plays</span>
            <strong>{currentTrack.plays}</strong>
          </div>
          <div>
            <span>Length</span>
            <strong>{currentTrack.duration}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default App;
